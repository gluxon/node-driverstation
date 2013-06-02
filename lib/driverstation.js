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

var dgram = require('dgram');
var crc32 = require('buffer-crc32');
var events = require('events');
var utils = require('./utils.js');

var RESET_BIT = 0x80;
var ESTOP_BIT = 0x40;
var ENABLED_BIT = 0x20;
var AUTONOMOUS_BIT = 0x10;
var FMS_ATTATCHED = 0x08;
var RESYNCH = 0x04;
var TEST_MODE_BIT = 0x02;
var CHECK_VERSIONS_BIT = 0x01;

var nfsd_keepalive = 1110;
var blaze = 1150;

function DriverStation() {
	this.updateInterval = 0.02 * 1000;
	this.connected = false;
	this.connection = new events.EventEmitter();
	this.missedPackets = 0;

	this.FRCCommonControlData = {
		packetIndex: 0,
		control: 0x44,
		dsDigitalIn: 0xff,
		teamID: 0x0000,
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

	this.robotData = null;
}

DriverStation.prototype.start = function(options) {
	this.ip = utils.getTeamIP(options.teamID);
	this.alliance = options.alliance;
	this.position = options.position;

	this.FRCCommonControlData.teamID = options.teamID;

	this.client = dgram.createSocket("udp4");
	this.waitForConnection();
};

DriverStation.prototype.waitForConnection = function() {
	var self = this;

	// Send packets at a slow rate to see if we get a response
	this.findTimer = setInterval(function() {
		self.send();
	}, this.updateInterval * 50);

	// Start receiving packets from robot
	this.listen();
};

DriverStation.prototype.connect = function(callback) {
	var self = this;

	// Automatically update status 50 times a second
	this.sendTimer = setInterval(function() {
		self.send();
		self.missedPackets++;
	}, this.updateInterval);

	// Timeout if there is no response
	setTimeout(function() {
		if (!self.connected) {
			callback("No Robot Communication");
			self.disconnect();
		}
	}, this.updateInterval * 5); // wait 5 packets before timeout
};

DriverStation.prototype.disconnect = function(callback) {
	clearInterval(this.sendTimer);
	this.connected = false;
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

	this.client.send(packet, 0, packet.length, nfsd_keepalive, this.ip, function(err, bytes) {
		if (err) console.err(err);
	});

	this.disconnectCheck();
};

DriverStation.prototype.listen = function() {
	var self = this;

	var server = dgram.createSocket("udp4");

	server.on("message", function (msg, rinfo) {
		if (self.findTimer) {
			// Established connection. Update at higher frequency.
			clearInterval(self.findTimer);
			self.findTimer = null;

			self.connect();
			self.connection.emit("connect");
		}

		self.connected = true;
		self.robotData = msg;
		self.missedPackets = 0;
	});

	server.bind(blaze);
};

DriverStation.prototype.disconnectCheck = function() {
	if (this.missedPackets > 10) {
		this.disconnect();
		this.missedPackets = 0;

		this.connection.emit('disconnect');
		this.waitForConnection();
	}
};

DriverStation.prototype.getData = function(callback) {
	var returnData = {};

	/*returnData.control = this.robotData.readInt8(0); // not sure of this yet
	returnData.battery = this.robotData.readInt8(1); // not sure of this yet */

	callback(returnData);
};

DriverStation.prototype.enable = function() {
	this.FRCCommonControlData.control = ENABLED_BIT;
};

DriverStation.prototype.estop = function() {
	this.FRCCommonControlData.control = ESTOP_BIT;
};

module.exports = new DriverStation();