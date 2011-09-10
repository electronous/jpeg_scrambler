function MarkerNotHandledError(marker)
{
	this.value = marker
	this.message = "Could not find handler for a parsed marker ";
	this.toString = function() {
		return this.message + this.value;
	};
}

function MarkerFirstByteError()
{
	this.message = "First byte of marker code was not 0xFF!";
	this.toString = function() {
		return this.message;
	};
}

function MarkerNotRecognizedError(code)
{
	this.value = code
	this.message = "Could not recognize a parsed marker code ";
	this.toString = function() {
		return this.message + this.value;
	};
}

// if jpeg.buffer and jpeg.buffer_index exist, then we build a header from
// the buffer, otherwise we simply build a new header de novo
function JpegHeader(jpeg)
{
	var that = this;
	var markers = {
		0xC0: 'SOF0',
		0xC1: 'SOF1',
		0xC2: 'SOF2',
		0xC3: 'SOF3',

		0xC4: 'DHT',

		0xC5: 'SOF5',
		0xC6: 'SOF6',
		0xC7: 'SOF7',
		0xC8: 'SOF_JPEG',
		0xC9: 'SOF9',
		0xCA: 'SOF10',
		0xCB: 'SOF11',

		0xCC: 'DAC',

		0xCD: 'SOF13',
		0xCE: 'SOF14',
		0xCF: 'SOF15',

		0xD8: 'SOI',
		0xD9: 'EOI',
		0xDA: 'SOS',
		0xDB: 'DQT',

		0xE0: 'APP0',
		0xE1: 'APP1',
		0xE2: 'APP2',
		0xE3: 'APP3',
		0xE4: 'APP4',
		0xE5: 'APP5',
		0xE6: 'APP6',
		0xE7: 'APP7',
		0xE8: 'APP8',
		0xE9: 'APP9',
		0xEA: 'APP10',
		0xEB: 'APP11',
		0xEC: 'APP12',
		0xED: 'APP13',
		0xEE: 'APP14',
		0xEF: 'APP15',
	};

	// zigzag order to standard (natural) array order lookup tables
	var zigzag_natural = {
		4: [0, 1, 8, 9],
		9: [0, 1, 8, 16, 9, 2, 10, 17, 18],
		16: [0, 1, 8, 16, 9, 2, 3, 10,
			17, 24, 25, 18, 11, 19, 26, 27],
		25: [0, 1, 8, 16, 9, 2, 3, 10,
			17, 24, 32, 25, 18, 11, 4, 12,
			19, 26, 33, 34, 27, 20, 28, 35,
			36],
		36: [0, 1, 8, 16, 9, 2, 3, 10,
			17, 24, 32, 25, 18, 11, 4, 5,
			12, 19, 26, 33, 40, 41, 34, 27,
			20, 13, 21, 28, 35, 42, 43, 36,
			29, 37, 44, 45],
		49: [0, 1, 8, 16, 9, 2, 3, 10,
			17, 24, 32, 25, 18, 11, 4,  5,
			12, 19, 26, 33, 40, 48, 41, 34,
			27, 20, 13, 6, 14, 21, 28, 35,
			42, 49, 50, 43, 36, 29, 22, 30,
			37, 44, 51, 52, 45, 38, 46, 53,
			54],
		64: [0, 1, 8, 16, 9, 2, 3, 10,
			17, 24, 32, 25, 18, 11, 4, 5,
			12, 19, 26, 33, 40, 48, 41, 34,
			27, 20, 13, 6, 7, 14, 21, 28,
			35, 42, 49, 56, 57, 50, 43, 36,
			29, 22, 15, 23, 30, 37, 44, 51,
			58, 59, 52, 45, 38, 31, 39, 46,
			53, 60, 61, 54, 47, 55, 62, 63]
	};

	var natural_zigzag = {
		4: [0, 1, 2, 3],
		9: [0, 1, 5, 2, 4, 6, 3, 7, 8],
		16: [0, 1, 5, 6, 2, 4, 7, 12,
			3, 8, 11, 13, 9, 10, 14, 15],
		25: [0, 1, 5, 6, 14, 2, 4, 7,
			13, 15, 3, 8, 12, 16, 21, 9, 11,
			17, 20, 22, 10, 18, 19, 23, 24],
		36: [0, 1, 5, 6, 14, 15, 2, 4, 7,
			13, 16, 25, 3, 8, 12, 17, 24, 26,
			9, 11, 18, 23, 27, 32, 10, 19, 22,
			28, 31, 33, 20, 21, 29, 30, 34, 35],
		49: [0, 1, 5, 6, 14, 15, 27, 2, 4, 7,
			13, 16, 26, 28, 3, 8, 12, 17, 25,
			29, 38, 9, 11, 18, 24, 30, 37,
			39, 10, 19, 23, 31, 36, 40, 45, 20,
			22, 32, 35, 41, 44, 46, 21, 33, 34,
			42, 43, 47, 48],
		64: [0, 1, 5, 6, 14, 15, 27, 28, 2, 4,
			7, 13, 16, 26, 29, 42, 3, 8, 12, 17,
			25, 30, 41, 43, 9, 11, 18, 24, 31,
			40, 44, 53, 10, 19, 23, 32, 39, 45,
			52, 54, 20, 22, 33, 38, 46, 51, 55,
			60, 21, 34, 37, 47, 50, 56, 59, 61,
			35, 36, 48, 49, 57, 58, 62, 63]
	};

	var marker_handlers = {};

	// starting decode functions
	function get_marker()
	{
		var marker;
		if (get_uint8() != 0xFF)
		{
			throw new MarkerFirstByteError();
		}
		jpeg.buffer_index += 1;
		that.marker_code = get_uint8();
		marker = markers[that.marker_code];
		if (marker === undefined)
		{
			throw new MarkerNotRecognizedError(that.marker_code.toString(16));
		}
		jpeg.buffer_index += 1;
		that.marker_name = marker;
		return marker;
	}

	function handle_marker(marker)
	{
		handler = marker_handlers[marker];
		if (handler === undefined)
		{
			throw new MarkerNotHandledError(marker);
		}
		return handler();
	}

	// this will simply pass by any headers that are variable length
	// useful for uninteresting headers
	function skip_generic_vlength()
	{
		// first field is a unsigned, 2-byte length field
		jpeg.buffer_index += get_uint16();
		that.save = false;
	}
	marker_handlers['APP1'] = skip_generic_vlength;
	marker_handlers['APP2'] = skip_generic_vlength;
	marker_handlers['APP3'] = skip_generic_vlength;
	marker_handlers['APP4'] = skip_generic_vlength;
	marker_handlers['APP5'] = skip_generic_vlength;
	marker_handlers['APP6'] = skip_generic_vlength;
	marker_handlers['APP7'] = skip_generic_vlength;
	marker_handlers['APP8'] = skip_generic_vlength;
	marker_handlers['APP9'] = skip_generic_vlength;
	marker_handlers['APP10'] = skip_generic_vlength;
	marker_handlers['APP11'] = skip_generic_vlength;
	marker_handlers['APP12'] = skip_generic_vlength;
	marker_handlers['APP13'] = skip_generic_vlength;
	marker_handlers['APP15'] = skip_generic_vlength;


	function save_generic_vlength()
	{
		var length = get_uint16();
		that._buf = jpeg.buffer.slice(jpeg.buffer_index, jpeg.buffer_index + length);
		that.inner_toBinaryString = function()
		{
			return that._buf;
		}
		jpeg.buffer_index += length;
	}
	marker_handlers['SOF0'] = save_generic_vlength;
	marker_handlers['SOF1'] = save_generic_vlength;
	marker_handlers['SOF2'] = save_generic_vlength;
	marker_handlers['SOF3'] = save_generic_vlength;
	
	marker_handlers['DHT'] = save_generic_vlength;
	
	marker_handlers['SOF5'] = save_generic_vlength;
	marker_handlers['SOF6'] = save_generic_vlength;
	marker_handlers['SOF7'] = save_generic_vlength;
	marker_handlers['SOF_JPEG'] = save_generic_vlength;
	marker_handlers['SOF9'] = save_generic_vlength;
	marker_handlers['SOF10'] = save_generic_vlength;
	marker_handlers['SOF11'] = save_generic_vlength;

	marker_handlers['DAC'] = save_generic_vlength;

	marker_handlers['SOF13'] = save_generic_vlength;
	marker_handlers['SOF14'] = save_generic_vlength;
	marker_handlers['SOF15'] = save_generic_vlength;

	marker_handlers['APP0'] = save_generic_vlength;
	marker_handlers['APP14'] = save_generic_vlength;

	function handle_sof(options)
	{
		return handle_generic_vlength();
	}

	function handle_sof0()
	{
		return handle_sof({});
	}

	function handle_sof1()
	{
		return handle_sof({'sequential': true});
	}

	function handle_soi()
	{
		// all default settings ok
		return;
	}
	marker_handlers['SOI'] = handle_soi;

	function handle_eoi()
	{
		// all default settings ok
		return;
	}
	marker_handlers['EOI'] = handle_eoi;

	function handle_dqt()
	{
		var index_and_prec, quant_index, precision, num_entries;
		var table, zigzag_lookup;
		var dqt_dim;
		var length = get_uint16();
		jpeg.buffer_index += 2;

		index_and_prec = get_uint8();
		jpeg.buffer_index += 1;
		quant_index = index_and_prec & 0x0F;
		precision = Boolean(index_and_prec >> 4);
		// XXX check quant_index against max

		num_entries = length - 3;
		if (precision == true)
		{
			num_entries /= 2;
		}

		table = new Array(num_entries);
		zigzag_lookup = zigzag_natural[num_entries];
		if (zigzag_lookup === undefined)
		{
			// XXX oh no
		}

		var i, entry;
		if (precision == true)
		{
			for (i = 0; i < num_entries; ++i)
			{
				table[zigzag_lookup[i]] = get_uint16();
				jpeg.buffer_index += 2;
			}
		} else {
			for (i = 0; i < num_entries; ++i)
			{
				table[zigzag_lookup[i]] = get_uint8();
				jpeg.buffer_index += 1;
			}
		}

		that.quantization_index = quant_index;
		that.quantization_precision = precision;
		that.quantization_table = table;

		that.inner_toBinaryString = function()
		{
			var ret = new Array();
			var length;
			var quant_index_and_precision;
			var natural_lookup;
			var table_length = that.quantization_table.length;
			var bytes_per_entry = 1;
			if (that.quantization_precision == true)
			{
				bytes_per_entry = 2;
			}

			// recalculate length
			length = 2 + 1 + (bytes_per_entry * table_length);

			ret.push(toBinaryString(length, 2));
			quant_index_and_precision = that.quantization_index | ((that.quantization_precision * 1) << 4);
			ret.push(toBinaryString(quant_index_and_precision, 1));

			var i;
			natural_lookup = natural_zigzag[table_length];
			if (natural_lookup === undefined)
			{
				// XXX oh no
			}
			for (i = 0; i < table_length; ++i)
			{
				ret.push(toBinaryString(that.quantization_table[natural_lookup[i]], bytes_per_entry));
			}

			return ret.join('');
		}

	}
	marker_handlers['DQT'] = handle_dqt;

	function handle_sos()
	{
		// XXX gimmicky hack
		that._buf = jpeg.buffer.slice(jpeg.buffer_index, -2);
		that.inner_toBinaryString = function()
		{
			return that._buf;
		}
		jpeg.buffer_index += that._buf.length;
	}
	marker_handlers['SOS'] = handle_sos;

	function handle_app0()
	{
		var length;
		length = get_uint16();
		jpeg.buffer_index += 2;

		return;
	}
	// below here are utility functions
	// get_uint8, getBits, etc

	// get functions for bytes are * big endian *
	// get_uint8
	function get_uint8()
	{
		return jpeg.buffer.charCodeAt(jpeg.buffer_index);
	}

	function get_uint16()
	{
		var high, low, value;
		high = jpeg.buffer.charCodeAt(jpeg.buffer_index);
		low = jpeg.buffer.charCodeAt(jpeg.buffer_index + 1);
		value = ((high << 8) & 0xFF00) | (low & 0x00FF);
		return value;
	}

	function toBinaryString(number, length)
	{
		if (length < 0)
		{
			// XXX :(
		}
		var ret = new Array();
		while (length > 0)
		{
			ret.push(String.fromCharCode(number & 0xff));
			number >>= 8;
			length -= 1;
		}
		ret.reverse();
		return ret.join('');
	}

	this.save = true;
	this.marker_code = 0;
	this.marker_name = "";
	this.inner_toBinaryString = function() { return ''; };
	this.toBinaryString = function()
	{
		return String.fromCharCode(0xFF) + String.fromCharCode(this.marker_code) + this.inner_toBinaryString();
	};

	handle_marker(get_marker());
}

function Jpeg(buffer)
{
	this.buffer = buffer;
	this.buffer_index = 0;

	this.headers = new Array();
	var header;
	
	header = new JpegHeader(this);
	if (header.marker_name != 'SOI')
	{
		throw NotJpegFileError;
	}
	this.headers.push(header);
	while (header.marker_name != 'EOI')
	{
		header = new JpegHeader(this);
		if (header.save == true)
		{
			this.headers.push(header);
		}
	}

	this.toBinaryString = function()
	{
		var bstrings = new Array();
		var len = this.headers.length;
		var i;
		for (i = 0; i < len; ++i)
		{
			bstrings.push(this.headers[i].toBinaryString());
		}
		return bstrings.join('');
	}
}



var base64_values = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function binaryStringToBase64(bstring)
{
	// base64 encodes 3 bytes to 4 characters
	// e.g. 77, 97, 110 -> T, W, F, u
	var input_bytes = new Array(3);
	var length = bstring.length;
	var output_temp = new Array(4);
	var output_chars = new Array();
	var index = 0;
	var leftover;

	leftover = length % 3;
	length -= (length % 3);
	// handle everything up to even multiple of 3
	while (index < length)
	{
		input_bytes[0] = bstring.charCodeAt(index);
		input_bytes[1] = bstring.charCodeAt(index + 1);
		input_bytes[2] = bstring.charCodeAt(index + 2);

		//         IN 0            IN 1            IN 2
		//  /7|6|5|4|3|2|1|0/7|6|5|4|3|2|1|0/7|6|5|4|3|2|1|0/
		//  /5|4|3|2|1|0/5|4|3|2|1|0/5|4|3|2|1|0/5|4|3|2|1|0/
		//     OUT 0       OUT 1       OUT 2       OUT 3

		// out 0
		output_temp[0] = ((input_bytes[0] & 0xFC) >> 2);

		// out 1
		output_temp[1] = (((input_bytes[0] & 0x03) << 4) | ((input_bytes[1] & 0xF0) >> 4));

		// out 2
		output_temp[2] = (((input_bytes[1] & 0x0F) << 2) | ((input_bytes[2] & 0xC0) >> 6));

		// out 3
		output_temp[3] = (input_bytes[2] & 0x3F);

		var i;
		for (i = 0; i < 4; ++i)
		{
			output_chars.push(base64_values.charAt(output_temp[i]));
		}

		index += 3;
	}

	// now handle leftover bytes with padding ('=')
	if (leftover == 1)
	{
		input_bytes[0] = bstring.charCodeAt(index);
		output_temp[0] = ((input_bytes[0] & 0xFC) >> 2);
		output_temp[1] = ((input_bytes[0] & 0x03) << 4);
		output_chars.push(base64_values.charAt(output_temp[0]));
		output_chars.push(base64_values.charAt(output_temp[1]));
		output_chars.push('=');
		output_chars.push('=');
	} else if (leftover == 2) {
		input_bytes[0] = bstring.charCodeAt(index);
		input_bytes[1] = bstring.charCodeAt(index + 1);
		output_temp[0] = ((input_bytes[0] & 0xFC) >> 2);
		output_temp[1] = (((input_bytes[0] & 0x03) << 4) | ((input_bytes[1] & 0xF0) >> 4));
		output_temp[2] = ((input_bytes[1] & 0x0F) << 2);
		output_chars.push(base64_values.charAt(output_temp[0]));
		output_chars.push(base64_values.charAt(output_temp[1]));
		output_chars.push(base64_values.charAt(output_temp[2]));
		output_chars.push('=');
	}

	return output_chars;
}

function handleFileSelect(evt)
{
	var file = evt.target.files[0];
	var reader = new FileReader();
	reader.onload = handleBinary;
	$('#text_here').text('Starting');
	reader.readAsBinaryString(file);

	function handleBinary()
	{
		var jpeg = new Jpeg(reader.result);
		var b64_input = binaryStringToBase64(jpeg.toBinaryString());
		var img_pieces = new Array();
		img_pieces.push('<img src="data:image/jpeg;base64,');
		img_pieces.push(b64_input.join(''));
		img_pieces.push('" >');
		$('#text_here').html(img_pieces.join(''));
	}

}

function foo()
{
	$('#input_file').change(handleFileSelect);
	$('#text_here').text('Ready!');
}

