var driverstation = (require('..'));

var options = {
	teamID: 178
};

driverstation.start(options);

driverstation.connection.on('connect', function() {
	console.log("connected!");
});

driverstation.connection.on('disconnect', function() {
	console.log("disconnected");
});

driverstation.enable();