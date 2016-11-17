var fs = require('fs')
	,reminders = require('../db/reminders.json')
	,updatedR = false;

setInterval(() => {
	if (updatedR) {
		updatedR = false;
		updateRemindDB();
	}
}, 60000)

function updateRemindDB() {
	fs.writeFile(__dirname + '/../db/reminders-temp.json', JSON.stringify(reminders), error=>{
		if (error) console.log(error)
		else {
			fs.stat(__dirname + '/../db/reminders-temp.json', (err, stats)=>{
				if (err) console.log(err)
				else if (stats["size"] < 2) console.log('Prevented reminders database from being overwritten');
				else {
					fs.rename(__dirname + '/../db/reminders-temp.json', __dirname + '/../db/reminders.json', e=>{if(e)console.log(e)});
					if (debug) console.log(cDebug(" DEBUG ") + " Updated reminders.json");
				}
			});
		}
	})
}

/*
Add Reminder:
	user: A user's ID
	date: The date in milliseconds
	text: The reminder to be sent
*/
exports.addReminder = function(user, date, text) {
	if (!user || !date || !text) return;
	reminders[date] = {"user": user, "text": text};
	updatedR = true;
};

exports.countForUser = function(user) {
	var count = 0;
	Object.keys(reminders).map(date=>{
		if (reminders[date].user == user) count++;
	});
	return count;
};

exports.listForUser = function(user) {
	var list = [];
	Object.keys(reminders).map(date=>{
		if (reminders[date].user == user) list.push(reminders[date].text+' **@** '+new Date(parseInt(date)).toUTCString());
	});
	return list;
};

exports.checkReminders = function(bot) {
	var now = Date.now();
	Object.keys(reminders).map(date=>{
		if (date <= now) {
			var recipent = bot.users.get('id', reminders[date].user);
			if (recipent) bot.sendMessage(recipent, "⏰ **Reminder:** "+reminders[date].text);
			if (debug) console.log(cDebug(" DEBUG ") + " Reminded user");
			delete reminders[date];
			updatedR = true;
		}
	});
};

/*
Remove Reminder:
	user: A user's ID
	text: The reminder to be removed
	success: function to run on completion
	fail: function to run if not found
*/
exports.removeReminder = function(text, user, success, fail) {
	if (!text || !user) return;
	var found = false;
	Object.keys(reminders).map(t=>{
		if (found) return;
		if (reminders[t].user == user && reminders[t].text.indexOf(text) > -1) {
			delete reminders[t];
			updatedR = true;
			if (debug) console.log(cDebug(" DEBUG ") + " Removed reminder for user " + user);
			found = true;
		}
	});
	if (found && typeof success == 'function') success();
	else if (!found && typeof fail == 'function') fail();
};
