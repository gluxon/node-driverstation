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
var client = dgram.createSocket("udp4");

var RESET_BIT = 0x80;
var ESTOP_BIT = 0x40;
var ENABLED_BIT = /*0x20*/ 0x60;
var AUTONOMOUS_BIT = 0x10;
var FMS_ATTATCHED = 0x08;
var RESYNCH = 0x04;
var TEST_MODE_BIT = 0x02;
var CHECK_VERSIONS_BIT = 0x01;

function DriverStation() {
	this.client = dgram.createSocket("udp4");
	this.port = 1066;
	this.updateInterval = 0.02;

	this.status = {
		packetIndex: 0,
		control: RESET_BIT,
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
}

DriverStation.prototype.connect = function(options, callback) {
	this.ip = options.ip;

	// for sake of time, just merge options with status
	for (var key in options) {
		this.status[key] = options[key];
	}

	// Automatically update status 50 times a second
	this.sendTimer = setInterval(this.send, this.updateInterval * 1000);

	callback(null);
}

DriverStation.prototype.disconnect = function(callback) {
	clearInterval(this.sendTimer);
}

DriverStation.prototype.send = function() {
	// send to cRIO
}

DriverStation.prototype.enable = function() {
	this.status.control = ENABLE_BIT;
}

DriverStation.prototype.estop = function() {
	this.status.control = ESTOP_BIT;
}

module.exports = DriverStation;