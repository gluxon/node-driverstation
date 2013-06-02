exports.getTeamIP = function(teamID) {
	teamID = String(teamID);

	var first = teamID.substring(0, teamID.length - 2);
	var second = teamID.substring(teamID.length - 2);

	if (first == "") first = "0";
	if (second == "") second = "0";

	return "10." + first + "." + second + ".2";
};