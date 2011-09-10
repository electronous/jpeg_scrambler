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

function decodeJpeg(raw)
{
	var marker;
	var _index = 0;

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

	var marker_handlers = {};
	marker_handlers['SOF0'] = handle_sof0;
	marker_handlers['SOF1'] = handle_sof1;
	marker_handlers['SOF2'] = handle_sof2;
	marker_handlers['SOF3'] = handle_sof3;
	
	marker_handlers['DHT'] = handle_dht;
	
	marker_handlers['SOF5'] = handle_sof5;
	marker_handlers['SOF6'] = handle_sof6;
	marker_handlers['SOF7'] = handle_sof7;
	marker_handlers['SOF_JPEG'] = handle_sof_jpeg;
	marker_handlers['SOF9'] = handle_sof9;
	marker_handlers['SOF10'] = handle_sof10;
	marker_handlers['SOF11'] = handle_sof11;
	
	marker_handlers['DAC'] = handle_dac;
	
	marker_handlers['SOF13'] = handle_sof13;
	marker_handlers['SOF14'] = handle_sof14;
	marker_handlers['SOF15'] = handle_sof15;

	marker_handlers['SOI'] = handle_soi;
	marker_handlers['EOI'] = handle_eoi;
	marker_handlers['SOS'] = handle_sos;
	marker_handlers['DQT'] = handle_dqt;

	marker_handlers['APP0'] = handle_app0;
	marker_handlers['APP1'] = handle_generic_vlength;
	marker_handlers['APP2'] = handle_generic_vlength;
	marker_handlers['APP3'] = handle_generic_vlength;
	marker_handlers['APP4'] = handle_generic_vlength;
	marker_handlers['APP5'] = handle_generic_vlength;
	marker_handlers['APP6'] = handle_generic_vlength;
	marker_handlers['APP7'] = handle_generic_vlength;
	marker_handlers['APP8'] = handle_generic_vlength;
	marker_handlers['APP9'] = handle_generic_vlength;
	marker_handlers['APP10'] = handle_generic_vlength;
	marker_handlers['APP11'] = handle_generic_vlength;
	marker_handlers['APP12'] = handle_generic_vlength;
	marker_handlers['APP13'] = handle_generic_vlength;
	marker_handlers['APP14'] = handle_app14;
	marker_handlers['APP15'] = handle_generic_vlength;

	this.trackers = {};

	start_decoding();

	function start_decoding()
	{
		marker = get_marker();
		if (marker != 'SOI')
		{
			throw NotJpegFileError;
		}
		handle_marker(marker);

		while (marker != 'EOI')
		{
			marker = get_marker();
			handle_marker(marker);
		}
	}

	// starting decode functions

	function get_marker()
	{
		var marker_code, marker;
		if (get_uint8() != 0xFF)
		{
			throw new MarkerFirstByteError();
		}
		_index += 1;
		marker_code = get_uint8();
		marker = markers[marker_code];
		if (marker === undefined)
		{
			throw new MarkerNotRecognizedError(marker_code.toString(16));
		}
		_index += 1;
		return marker;
	}

	function handle_marker(marker)
	{
		handler = marker_handlers[marker];
		if (handler === undefined)
		{
			throw new MarkerNotHandledError(marker);
		}
		tracker = this.trackers[marker];
		if (tracker === undefined)
		{
			tracker = new Array();
		}
		tracker.push(_index);
		this.trackers[marker] = tracker;
		return handler();
	}

	// this will simply pass by any headers that are variable length
	// useful for uninteresting headers
	function handle_generic_vlength()
	{
		// first field is a unsigned, 2-byte length field
		_index += get_uint16();
	}

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
		return;
	}

	function handle_app0()
	{
		var length;
		length = get_uint16();
		_index += 2;

		return;
	}
	// below here are utility functions
	// get_uint8, getBits, etc

	// get functions for bytes are * big endian *
	// get_uint8
	function get_uint8()
	{
		return raw.charCodeAt(_index);
	}

	function get_uint16()
	{
		var high, low, value;
		high = raw.charCodeAt(_index);
		low = raw.charCodeAt(_index + 1);
		value = ((high << 8) & 0xFF00) | (low & 0x00FF);
		return value;
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
		//decodeJpeg(reader.result);
		var b64_input = binaryStringToBase64(reader.result);
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

