var driverstation = (require('..'));

var options = {
	ip: '10.1.78.2',
	teamID: 178
};

driverstation.start(options);
driverstation.connect(function(err) {
	if (err) throw err;
});

driverstation.enable();