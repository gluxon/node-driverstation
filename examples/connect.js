var driverstation = new (require('..'));

var options = {
	ip: '10.1.78.2'
};

driverstation.connect(options, function(err) {
	if (err) throw err;
});