var driverstation = new (require('..'));

var options = {
	ip: '10.1.78.1'
};

driverstation.connect(options, function(err) {
	if (err) throw err;
});