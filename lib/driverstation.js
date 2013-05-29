// Copyright (c) 2013 Brandon Cheng <gluxon@gluxon.com> (http://gluxon.com)
// node-driverstation: Node.js API for the client-side FRC Driver Station
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var crc32 = require('buffer-crc32');
var dgram = require('dgram');
var client = dgram.createSocket("udp4");

var RESET_BIT = 0x80;
var ESTOP_BIT = 0x40;
var ENABLED_BIT = 0x20;
var AUTONOMOUS_BIT = 0x10;
var FMS_ATTATCHED = 0x08;
var RESYNCH = 0x04;
var TEST_MODE_BIT = 0x02;
var CHECK_VERSIONS_BIT = 0x01;

function DriverStation() {
	this.client = dgram.createSocket("udp4");
	this.nfsd_keepalive = 1110;
	this.blaze = 1150;
	this.updateInterval = 0.02;

	this.FRCCommonControlData = {
		packetIndex: 0,
		control: 0x60,
		dsDigitalIn: 0xff,
		teamID: 0x00b2,
		dsID_Alliance: 0x52,
		dsID_Position: 0x31,
		stick0Axes: null,
		stick0Buttons: null,
		stick1Axes: null,
		stick1Buttons: null,
		stick2Axes: null,
		stick2Buttons: null,
		stick3Axes: null,
		stick3Buttons: null,
		analog1: null,
		analog2: null,
		analog3: null,
		analog4: null,
	};

	this.robotData = {
		battery: null,
		dsDigitalOut: null,
		updateNumber: null,
		userDataHigh: null,
		userDatahighLength: null,
		userDataLow: null,
		userDataLowLength: null,
		wait_ms: null
	};
}

DriverStation.prototype.connect = function(options, callback) {
	var self = this;

	this.ip = options.ip;

	// for sake of time, just merge options with status
	for (var key in options) {
		this.FRCCommonControlData[key] = options[key];
	}

	// Automatically update status 50 times a second
	this.sendTimer = setInterval(function() {
		self.send();
	}, this.updateInterval * 1000);

	callback(null);

	this.listen();
};

DriverStation.prototype.disconnect = function(callback) {
	clearInterval(this.sendTimer);
};

DriverStation.prototype.send = function() {
	this.FRCCommonControlData.packetIndex++;

	var packet = new Buffer(1024);
	packet.fill(0x00);

	packet.writeUInt16BE(this.FRCCommonControlData.packetIndex, 0, 2);
	packet.writeUInt8(this.FRCCommonControlData.control, 2, 1);

	packet.writeUInt8(this.FRCCommonControlData.dsDigitalIn, 3, 1);
	packet.writeUInt16BE(this.FRCCommonControlData.teamID, 4, 2);

	packet.writeUInt8(this.FRCCommonControlData.dsID_Alliance, 6, 1);
	packet.writeUInt8(this.FRCCommonControlData.dsID_Position, 7, 1);

	packet.writeDoubleBE(this.FRCCommonControlData.stick0Axes, 8, 6);
	packet.writeUInt16BE(this.FRCCommonControlData.stick0Buttons, 14, 2);

	packet.writeDoubleBE(this.FRCCommonControlData.stick1Axes, 16, 6);
	packet.writeUInt16BE(this.FRCCommonControlData.stick1Buttons, 22, 2);

	packet.writeDoubleBE(this.FRCCommonControlData.stick2Axes, 24, 6);
	packet.writeUInt16BE(this.FRCCommonControlData.stick2Buttons, 30, 2);

	packet.writeDoubleBE(this.FRCCommonControlData.stick3Axes, 32, 6);
	packet.writeUInt16BE(this.FRCCommonControlData.stick3Buttons, 38, 2);

	packet.writeUInt16BE(this.FRCCommonControlData.analog1, 40, 2);
	packet.writeUInt16BE(this.FRCCommonControlData.analog2, 42, 2);
	packet.writeUInt16BE(this.FRCCommonControlData.analog3, 44, 2);
	packet.writeUInt16BE(this.FRCCommonControlData.analog4, 46, 2);

	var crc = crc32(packet);
	crc.copy(packet, packet.length-4);

	client.send(packet, 0, packet.length, this.nfsd_keepalive, this.ip, function(err, bytes) {
		if (err) console.err(err);
	});
};

DriverStation.prototype.listen = function() {
	var server = dgram.createSocket("udp4");

	server.on("message", function (msg, rinfo) {
		console.log("server got: " + msg + " from " +
			  rinfo.address + ":" + rinfo.port);
	});

	server.on("listening", function () {
		var address = server.address();
		console.log("server listening " +
				address.address + ":" + address.port);
	});

	server.bind(this.blaze);
};

DriverStation.prototype.enable = function() {
	this.status.control = ENABLE_BIT;
};

DriverStation.prototype.estop = function() {
	this.status.control = ESTOP_BIT;
};

module.exports = DriverStation;