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
var util = require("util");
var events = require("events");
var utils = require('./utils.js');

// These are all unused in the code currently (0x means hexadecimal)
var RESET_BIT = 0x80;
var FMS_ATTATCHED = 0x08;
var RESYNCH = 0x04;
var CHECK_VERSIONS_BIT = 0x01;

// All values found by trial-and-error. Feel free to update with better ones.
var MODES = {
    'Teleoperated': 0x60,
    'Autonomous': 0x70,
    'Disabled': 0x40,
    'Test': 0x62,
	'Soft Reboot': 0x80,
    'Emergency Stopped': 0x00
};

var nfsd_keepalive = 1110;
var blaze = 1150;

function DriverStation() {
	events.EventEmitter.call(this);

	this.updateInterval = 0.02 * 1000;
	this.connected = false;
	this.missedPackets = 0;

	this.client = dgram.createSocket("udp4");

	this.FRCCommonControlData = {
		packetIndex: 0,
		control: 0x40,
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

util.inherits(DriverStation, events.EventEmitter);

DriverStation.prototype.start = function(options) {
	this.setTeamID(options.teamID);
	this.alliance = options.alliance;
	this.position = options.position;
};

DriverStation.prototype.setTeamID = function(teamID, callback) {
	var isValid = utils.validTeamID(teamID);

	if (isValid === true) {
		this.ip = utils.getTeamIP(teamID);
		this.FRCCommonControlData.teamID = teamID;
		if (!this.connected && !this.findTimer) { // start if not connected
			this.waitForConnection();
		}
	} else {
		this.disconnect();
	}

	if (callback) {
		if (isValid !== true) {
			callback(isValid); // send the error
		} else {
			callback(null);
		}
	}
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
	clearInterval(this.findTimer);
	this.connected = false;
	this.emit('disconnect');
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
		if (err) console.error(err);
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
			self.emit("connect");
		}

		self.connected = true;
		self.emit("robotData", self.parseRobotData(msg));
		self.missedPackets = 0;
	});

	server.bind(blaze);
};

DriverStation.prototype.parseRobotData = function(robotData) {
	var control = robotData.readUInt8(0);
	var batteryVolts = robotData.toString('hex', 1, 2) + "." + robotData.toString('hex', 2, 3);
	var dsDigitalOut = robotData.readUInt8(3);
	var teamID = robotData.readUInt16BE(8);
	var macAddress = robotData.toString('hex', 10, 16);
	var packetIndex = robotData.readUInt16BE(30);

	var updateNumber = robotData.readUInt8(32);

	var userDataHighLength = robotData.readInt32BE(33);
	var userDataHigh_start = 33 + 4;
	var userDataHigh_end = userDataHigh_start + userDataHighLength;
	var userDataHigh = robotData.slice(userDataHigh_start, userDataHigh_end);

	var errorDataLength = robotData.readInt32BE(userDataHigh_end);
	var errorData_start = userDataHigh_end + 4;
	var errorData_end = errorData_start + errorDataLength;
	var errorData = robotData.slice(errorData_start, errorData_end);

	var userDataLowLength = robotData.readInt32BE(errorData_end);
	var userDataLow_start = errorData_end + 4;
	var userDataLow_end = userDataLow_start + userDataLowLength;
	var userDataLow = robotData.slice(userDataLow_start, userDataLow_end);

	var userDsLcdData = robotData.slice(1026, 1152);

    var robotCode = robotData.readUInt8(953);
    robotCode = (robotCode >= 91 && robotCode <= 92);

	return {
		'control': control,
		'batteryVolts': batteryVolts,
		'dsDigitalOut': dsDigitalOut,
		'teamID': teamID,
		'robotCode': robotCode,
		'macAddress': macAddress,
		'packetIndex': packetIndex,
		'updateNumber': updateNumber,
		'userDataHighLength': userDataHighLength,
		'userDataHigh': userDataHigh,
		'errorDataLength': errorDataLength,
		'errorData': errorData.toString('ascii'),
		'userDataLowLength': userDataLowLength,
		'userDataLow': userDataLow,
		'userDsLcdData': userDsLcdData.toString('ascii')
	};
};

DriverStation.prototype.disconnectCheck = function() {
	if (this.missedPackets > 10) {
		this.disconnect();
		this.missedPackets = 0;

		this.waitForConnection();
	}
};

DriverStation.prototype.enable = function(mode) {
	var mode_bits = MODES[mode];
    if ( ! mode_bits)
    {
        console.error('Unknown Mode: ' + mode);
        return;
    }

    this.FRCCommonControlData.control = mode_bits;
};

DriverStation.prototype.disable = function() {
    this.FRCCommonControlData.control = MODES['Disabled'];
};

DriverStation.prototype.estop = function() {
	this.FRCCommonControlData.control = MODES['Emergency Stopped'];
};

DriverStation.prototype.reboot = function() {
	this.FRCCommonControlData.control = MODES['Soft Reboot'];
};

module.exports = new DriverStation();
