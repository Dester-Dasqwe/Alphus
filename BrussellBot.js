//Run this with node to run the bot.

var commands = require("./bot/commands.js")
	,mod = require("./bot/mod.js")
	,config = require("./bot/config.json")
	,games = require("./bot/games.json")
	,versioncheck = require("./bot/versioncheck.js")
	,discord = require("discord.js")
	,cleverbot = require("./bot/cleverbot.js").cleverbot
	,db = require("./bot/db.js")
	,request = require('request')
	,remind = require('./bot/remind.js')
	,chalk = require('chalk')
	,clk = new chalk.constructor({enabled: true})
//==TatsuBot Stuff
	,mysql = require("mysql")                       //node-mysql lib
	,mysql_db = require("./bot/mysql.js")               //mysql helper class
	,async = require("async")                      //node-async lib
	,moment = require('moment')                     //Moment.js lib
	,rss_config = require("./bot/rss_settings.json")    //rss config file for bot
	,Stopwatch = require('statman-stopwatch');

cWarn = clk.bgYellow.black;
cError = clk.bgRed.black;
cDebug = clk.bgWhite.black;
cGreen = clk.bold.green;
cGrey = clk.bold.grey;
cYellow = clk.bold.yellow;
cBlue = clk.bold.blue;
cRed = clk.bold.red;
cServer = clk.bold.magenta;
cUYellow = clk.bold.underline.yellow;
cBgGreen = clk.bgGreen.black;

checkConfig();

var lastExecTime = {}
	,pmCoolDown = {};
setInterval(() => {lastExecTime = {};pmCoolDown = {}},3600000);
commandsProcessed = 0, talkedToTimes = 0;
show_warn = config.show_warn, debug = config.debug;

var bot = new discord.Client({maxCachedMessages: 10, forceFetchUsers: true});
bot.on("error", m=>{ console.log(cError(" WARN ") + " " + m); });
bot.on("warn", m=>{ if (show_warn) console.log(cWarn(" WARN ") + " " + m); });
bot.on("debug", m=>{ if (debug) console.log(cDebug(" DEBUG ") +  " " + m); });

bot.on("ready", () => {
	bot.setPlayingGame(games[Math.floor(Math.random() * (games.length))]);
	console.log(cGreen("TatsuBot is ready!") + " Listening to " + bot.channels.length + " channels on " + bot.servers.length + " servers");
	versioncheck.checkForUpdate();
	setTimeout(()=>{db.checkServers(bot)},10000);
	remind.checkReminders(bot);
	if (config.carbon_key) {
		request.post({
				"url": "https://www.carbonitex.net/discord/data/botdata.php",
				"headers": {"content-type": "application/json"}, "json": true,
				body: {
					"key": config.carbon_key,
					"servercount": bot.servers.length
				}
			}, (e, r)=>{
			if (config.debug) console.log(cDebug(" DEBUG ") + " Updated Carbon server count");
			if (e) console.log("Error updating carbon stats: " + e);
			if (r.statusCode !== 200) console.log("Error updating carbon stats: Status Code " + r.statusCode);
		});
	}
});

bot.on("disconnected", () => {
	console.log(cRed("Disconnected") + " from Discord");
	commandsProcessed = 0, talkedToTimes = 0, lastExecTime = {};
	setTimeout(() => {
		console.log("Attempting to log in...");
		bot.loginWithToken(config.token, (err, token) => {
			if (err) { console.log(err); setTimeout(() => { process.exit(1); }, 2000); }
			if (!token) { console.log(cWarn(" WARN ") + " failed to connect"); setTimeout(() => { process.exit(0); }, 2000); }
		});
	});
});

bot.on("message", msg => {
	if (msg.author.id == bot.user.id) return;
	if (msg.channel.isPrivate) {
		if (/(^https?:\/\/discord\.gg\/[A-Za-z0-9]+$|^https?:\/\/discordapp\.com\/invite\/[A-Za-z0-9]+$)/.test(msg.content))
			bot.sendMessage(msg.author, "**Tatsu-chan invite link: ** <https://discordapp.com/oauth2/authorize?&client_id=" + config.app_id + "&scope=bot&permissions=12659727> \n*I-I-Its not like I want to join your server or anything!* :flushed:");
		else if (msg.content[0] !== config.command_prefix && msg.content[0] !== config.mod_command_prefix && !msg.content.startsWith('(eval) ')) {
			if (pmCoolDown.hasOwnProperty(msg.author.id)) {
				if (Date.now() - pmCoolDown[msg.author.id] > 3000) {
					if (/^(help|how do I use this\??)$/i.test(msg.content)) {
						commands.commands["help"].process(bot, msg);
						return;
					}
					pmCoolDown[msg.author.id] = Date.now();
					cleverbot(bot, msg);
					talkedToTimes += 1;
					return;
				}
			} else {
				pmCoolDown[msg.author.id] = Date.now();
				if (/^(help|how do I use this\??)$/i.test(msg.content)) {
					commands.commands["help"].process(bot, msg);
					return;
				}
				cleverbot(bot, msg);
				talkedToTimes += 1;
				return;
			}
		}
	} else {
		if (msg.mentions.length !== 0) {
			if (msg.isMentioned(bot.user) && msg.content.startsWith("<@" + bot.user.id + ">")) {
				if (ServerSettings.hasOwnProperty(msg.channel.server.id)) { if (ServerSettings[msg.channel.server.id].ignore.indexOf(msg.channel.id) === -1) {
					cleverbot(bot, msg); talkedToTimes += 1; db.updateTimestamp(msg.channel.server);
				}} else { cleverbot(bot, msg); talkedToTimes += 1; db.updateTimestamp(msg.channel.server); }
			}
			if (msg.content.indexOf("<@" + config.admin_id + ">") > -1) {
				if (config.send_mentions) {
					var owner = bot.users.get("id", config.admin_id);
					if (owner && owner.status != "online") {
						var toSend = "";
						if (msg.channel.messages.length >= 3) {
							var mIndex = msg.channel.messages.indexOf(msg);
							if (Date.now() - msg.channel.messages[mIndex-2].timestamp <= 120000)
								toSend += msg.channel.messages[mIndex-2].cleanContent + "\n\n";
							if (Date.now() - msg.channel.messages[mIndex-1].timestamp <= 120000)
								toSend += msg.channel.messages[mIndex-1].cleanContent + "\n\n";
							if (toSend.length + msg.cleanContent.length >= 1930)
								toSend = msg.cleanContent.substr(0, 1930);
							else toSend += msg.cleanContent.substr(0, 1930);
							bot.sendMessage(owner, msg.channel.server.name + " > " + msg.author.username + ":\n" + toSend);
						} else bot.sendMessage(owner, msg.channel.server.name + " > " + msg.author.username + ":\n" + msg.cleanContent.substr(0, 1930));
					}
				}
			}
		}
	}
	if (msg.author.id == config.admin_id && msg.content.startsWith("(eval) ")) { evaluateString(msg); return; } //bot owner eval command
	if (!msg.content.startsWith(config.command_prefix) && !msg.content.startsWith(config.mod_command_prefix)) return;
	if (msg.content.indexOf(" ") == 1 && msg.content.length > 2) { msg.content = msg.content.replace(" ", ""); }
	if (!msg.channel.isPrivate && !msg.content.startsWith(config.mod_command_prefix) && ServerSettings.hasOwnProperty(msg.channel.server.id)) {
		if (ServerSettings[msg.channel.server.id].ignore.indexOf(msg.channel.id) > -1) return;
	}
	var cmd = msg.content.split(" ")[0].replace(/\n/g, " ").substring(config.command_prefix.length).toLowerCase();
	var suffix = msg.content.replace(/\n/g, " ").substring(cmd.length + 2).trim();
	
	//console.log(msg.content + " | " + cmd + " | " + suffix);//test
	//console.log(msg.content.split(" ")[0].replace(/\n/g, " ").substring(config.command_prefix.length));
	//console.log(msg.content.replace(/\n/g," ").substring(cmd.length + 2).trim());
	//console.log(msg.content.startsWith(config.command_prefix) || msg.content.startsWith(config.mod_command_prefix));
	
	if (msg.content.startsWith(config.command_prefix)) {
		if (commands.commands.hasOwnProperty(cmd)) execCommand(msg, cmd, suffix, "normal");
		else if (commands.aliases.hasOwnProperty(cmd)) {
			if (!msg.channel.isPrivate) db.updateTimestamp(msg.channel.server);
			msg.content = msg.content.replace(/[^ ]+ /, config.command_prefix + commands.aliases[cmd] + " ");
			execCommand(msg, commands.aliases[cmd], suffix, "normal");
		}
	} else if (msg.content.startsWith(config.mod_command_prefix)) {
		if (cmd == "reload" && msg.author.id == config.admin_id) { reload(); bot.deleteMessage(msg); return; }
		if (mod.commands.hasOwnProperty(cmd)) execCommand(msg, cmd, suffix, "mod");
		else if (mod.aliases.hasOwnProperty(cmd)) {
			if (!msg.channel.isPrivate) db.updateTimestamp(msg.channel.server);
			msg.content = msg.content.replace(/[^ ]+ /, config.mod_command_prefix + mod.aliases[cmd] + " ");
			execCommand(msg, mod.aliases[cmd], suffix, "mod");
		}
	}
});

function execCommand(msg, cmd, suffix, type) {
	try {
		commandsProcessed += 1;
		if (type == "normal") {
			if (!msg.channel.isPrivate) console.log(cServer(msg.channel.server.name) + " > " + cGreen(msg.author.username) + " > " + msg.cleanContent.replace(/\n/g, " "));
			else console.log(cGreen(msg.author.username) + " > " + msg.cleanContent.replace(/\n/g, " "));
			if (msg.author.id != config.admin_id && commands.commands[cmd].hasOwnProperty("cooldown")) {
				if (!lastExecTime.hasOwnProperty(cmd)) lastExecTime[cmd] = {};
				if (!lastExecTime[cmd].hasOwnProperty(msg.author.id)) lastExecTime[cmd][msg.author.id] = new Date().valueOf();
				else {
					var now = Date.now();
					if (now < lastExecTime[cmd][msg.author.id] + (commands.commands[cmd].cooldown * 1000)) {
						bot.sendMessage(msg, msg.author.username.replace(/@/g, '@\u200b') + ", you need to *cooldown* (" + Math.round(((lastExecTime[cmd][msg.author.id] + commands.commands[cmd].cooldown * 1000) - now) / 1000) + " seconds)", (e, m)=>{ bot.deleteMessage(m, {"wait": 6000}); });
						if (!msg.channel.isPrivate) bot.deleteMessage(msg, {"wait": 10000});
						return;
					} lastExecTime[cmd][msg.author.id] = now;
				}
			}
			commands.commands[cmd].process(bot, msg, suffix);
			if (!msg.channel.isPrivate && commands.commands[cmd].hasOwnProperty("deleteCommand")) {
				if (commands.commands[cmd].deleteCommand === true && ServerSettings.hasOwnProperty(msg.channel.server.id) && ServerSettings[msg.channel.server.id].deleteCommands == true) bot.deleteMessage(msg, {"wait": 10000});
			}
		} else if (type == "mod") {
			if (!msg.channel.isPrivate)
				console.log(cServer(msg.channel.server.name) + " > " + cGreen(msg.author.username) + " > " + cBlue(msg.cleanContent.replace(/\n/g, " ").split(" ")[0]) + msg.cleanContent.replace(/\n/g, " ").substr(msg.cleanContent.replace(/\n/g, " ").split(" ")[0].length));
			else console.log(cGreen(msg.author.username) + " > " + cBlue(msg.cleanContent.replace(/\n/g, " ").split(" ")[0]) + msg.cleanContent.replace(/\n/g, " ").substr(msg.cleanContent.replace(/\n/g, " ").split(" ")[0].length));
			if (msg.author.id != config.admin_id && mod.commands[cmd].hasOwnProperty("cooldown")) {
				if (!lastExecTime.hasOwnProperty(cmd)) lastExecTime[cmd] = {};
				if (!lastExecTime[cmd].hasOwnProperty(msg.author.id)) lastExecTime[cmd][msg.author.id] = new Date().valueOf();
				else {
					var now = Date.now();
					if (now < lastExecTime[cmd][msg.author.id] + (mod.commands[cmd].cooldown * 1000)) {
						bot.sendMessage(msg, msg.author.username.replace(/@/g, '@\u200b') + ", you need to *cooldown* (" + Math.round(((lastExecTime[cmd][msg.author.id] + mod.commands[cmd].cooldown * 1000) - now) / 1000) + " seconds)", (e, m)=>{ bot.deleteMessage(m, {"wait": 6000}); });
						if (!msg.channel.isPrivate) bot.deleteMessage(msg, {"wait": 10000});
						return;
					} lastExecTime[cmd][msg.author.id] = now;
				}
			}
			mod.commands[cmd].process(bot, msg, suffix);
			if (!msg.channel.isPrivate && mod.commands[cmd].hasOwnProperty("deleteCommand")) {
				if (mod.commands[cmd].deleteCommand === true && ServerSettings.hasOwnProperty(msg.channel.server.id) && ServerSettings[msg.channel.server.id].deleteCommands == true) bot.deleteMessage(msg, {"wait": 10000});
			}
		} else return;
	} catch (err) { console.log(err.stack); }
}

/* Event Listeners */
bot.on("serverNewMember", (objServer, objUser) => {
	if (config.non_essential_event_listeners && ServerSettings.hasOwnProperty(objServer.id) && ServerSettings[objServer.id].welcome != "none") {
		if (!objUser.username || !ServerSettings[objServer.id].welcome || !objServer.name) return;
		if (debug) { console.log("New member on " + objServer.name + ": " + objUser.username); }
		bot.sendMessage(objServer.defaultChannel, ServerSettings[objServer.id].welcome.replace(/\$USER\$/gi, objUser.username.replace(/@/g, '@\u200b')).replace(/\$SERVER\$/gi, objServer.name.replace(/@/g, '@\u200b')));
	}
});

bot.on("channelDeleted", channel => {
	if (channel.isPrivate) return;
	if (ServerSettings.hasOwnProperty(channel.server.id)) {
		if (ServerSettings[channel.server.id].ignore.indexOf(channel.id) > -1) {
			db.unignoreChannel(channel.id, channel.server.id);
			if (debug) console.log(cDebug(" DEBUG ") + " Ignored channel was deleted and removed from the DB");
		}
	}
});

bot.on("userBanned", (objUser, objServer) => {
	if (config.non_essential_event_listeners && ServerSettings.hasOwnProperty(objServer.id) && ServerSettings[objServer.id].banAlerts == true) {
		console.log(objUser.username + cRed(" banned on ") + objServer.name);
		if (ServerSettings[objServer.id].notifyChannel != "general") bot.sendMessage(ServerSettings[objServer.id].notifyChannel, "⚠ " + objUser.username.replace(/@/g, '@\u200b') + " was banned");
		else bot.sendMessage(objServer.defaultChannel, "🍌🔨 " + objUser.username.replace(/@/g, '@\u200b') + " was banned");
		bot.sendMessage(objUser, "🍌🔨 You were banned from " + objServer.name);
	}
});

bot.on("userUnbanned", (objUser, objServer) => {
	if (objServer.members.length <= 500 && config.non_essential_event_listeners) { console.log(objUser.username + " unbanned on " + objServer.name); }
});

bot.on("presence", (userOld, userNew) => {
	if (config.log_presence) {
		if ((userNew.status != userOld.status) && (userNew.game === null || userNew.game === undefined)) console.log(cDebug(" PRESENCE ") + " " + userNew.username + " is now " + userNew.status);
		else if (userNew.status != userOld.status) console.log(cDebug(" PRESENCE ") + " " + userNew.username + " is now " + userNew.status + " playing " + userNew.game.name);
	}
	if (config.non_essential_event_listeners) {
		if (userOld.username == undefined || userNew.username == undefined) return;
		if (userOld.username != userNew.username) {
			bot.servers.map(ser => {
				if (ServerSettings.hasOwnProperty(ser.id) && ServerSettings[ser.id].nameChanges == true) {
					if (ser.members.find(x=>x.id==userOld.id)) {
						if (ServerSettings[ser.id].notifyChannel == "general") bot.sendMessage(ser, "**`" + userOld.username.replace(/@/g, '@\u200b') + "`** is now known as **`" + userNew.username.replace(/@/g, '@\u200b') + "`**");
						else bot.sendMessage(ServerSettings[ser.id].notifyChannel, "**`" + userOld.username.replace(/@/g, '@\u200b') + "`** is now known as **`" + userNew.username.replace(/@/g, '@\u200b') + "`**");
					}
				}
			});
		}
	}
});

bot.on("serverDeleted", objServer => {
	console.log(cUYellow("Left server") + " " + objServer.name);
	db.handleLeave(objServer);
});

bot.on("serverCreated", server => {
	if (db.serverIsNew(server)) {
		console.log(cGreen("Joined server: ") + server.name);
		if (config.banned_server_ids && config.banned_server_ids.indexOf(server.id) > -1) {
			console.log(cRed("Joined server but it was on the ban list") + ": " + server.name);
			bot.sendMessage(server.defaultChannel, "This server is on the ban list");
			setTimeout(()=>{bot.leaveServer(server);},1000);
		} else {
			var toSend = [];
			toSend.push("Hey! I'm **" + bot.user.username.replace(/@/g, '@\u200b') + "**");
			toSend.push("You can use **`" + config.command_prefix + "help`** to see what I am capable of.");
			toSend.push("Mod/Admin commands *including bot settings* can be viewed with **`" + config.mod_command_prefix + "help`**");
			toSend.push("For help & info go to **<http://tatsumaki.friday.cafe>**");
			toSend.push("*I-Its not like I wanted to be here! I was j-just told to!*");
			bot.sendMessage(server.defaultChannel, toSend);
			db.addServer(server);
			db.addServerToTimes(server);
		}
	}
});

/* Login */
console.log("Logging in...");
bot.loginWithToken(config.token, (err, token) => {
	if (err) { console.log(err); setTimeout(() => { process.exit(1); }, 2000); }
	if (!token) { console.log(cWarn(" WARN ") + " failed to connect"); setTimeout(() => { process.exit(0); }, 2000); }
});

function reload() {
	delete require.cache[require.resolve(__dirname + "/bot/config.json")];
	delete require.cache[require.resolve(__dirname + "/bot/games.json")];
	delete require.cache[require.resolve(__dirname + "/bot/commands.js")];
	delete require.cache[require.resolve(__dirname + "/bot/mod.js")];
	delete require.cache[require.resolve(__dirname + "/bot/versioncheck.js")];
	delete require.cache[require.resolve(__dirname + "/bot/cleverbot.js")];
	delete require.cache[require.resolve(__dirname + "/bot/db.js")];
	delete require.cache[require.resolve(__dirname + "/bot/remind.js")];
	config = 			require(__dirname + "/bot/config.json");
	games = 			require(__dirname + "/bot/games.json");
	versioncheck = 		require(__dirname + "/bot/versioncheck.js");
	cleverbot = 		require(__dirname + "/bot/cleverbot").cleverbot;
	db = 				require(__dirname + "/bot/db.js");
	remind = 			require(__dirname + "/bot/remind.js");
	try { commands = 	require(__dirname + "/bot/commands.js");
	} catch (err) { console.log(cError(" ERROR ") + " Problem loading commands.js: " + err); }
	try { mod = 		require(__dirname + "/bot/mod.js");
	} catch (err) { console.log(cError(" ERROR ") + " Problem loading mod.js: " + err); }
	console.log(cBgGreen(" Module Reload ") + " Success");
}

function checkConfig() {
	if (!config.token) { console.log(cWarn(" WARN ") + " Token not defined"); }
	if (!config.app_id) { console.log(cWarn(" WARN ") + " App ID not defined"); }
	if (!config.command_prefix || config.command_prefix.length < 1) { console.log(cWarn(" WARN ") + " Prefix either defined"); }
	if (!config.mod_command_prefix || config.mod_command_prefix.length < 1) { console.log(cWarn(" WARN ") + " Mod prefix not defined"); }
	if (!config.admin_id) { console.log(cYellow("Admin user's id") + " not defined in config"); }
	if (!config.mal_user) { console.log(cYellow("MAL username") + " not defined in config"); }
	if (!config.mal_pass) { console.log(cYellow("MAL password") + " not defined in config"); }
	if (!config.weather_api_key) { console.log(cYellow("OpenWeatherMap API key") + " not defined in config"); }
	if (!config.osu_api_key) { console.log(cYellow("Osu API key") + " not defined in config"); }
	if (!config.imgur_client_id) { console.log(cYellow("Imgur client id") + " not defined in config"); }
	if (!config.carbon_key) { console.log(cYellow("Carbon Key") + " not defined in config"); }
	if (!config.yourls_sig_token) { console.log(cYellow("Yourls Sig Token") + " not defined in config"); }
}

function evaluateString(msg) {
	if (msg.author.id != config.admin_id) { console.log(cWarn(" WARN ") + " Somehow an unauthorized user got into eval!"); return; }
	var timeTaken = new Date(), result;
	console.log("Running eval");
	try { result = eval(msg.content.substring(7).replace(/\n/g, ""));
	} catch (e) { console.log(cError(" ERROR ") + " " + e); bot.sendMessage(msg, "```diff\n- " + e + "```"); }
	if (result && typeof result !== 'object') bot.sendMessage(msg, "`Compute time: " + (timeTaken - msg.timestamp) + "ms`\n" + result);
	console.log("Result: " + result);
}

setInterval(() => {
	bot.setPlayingGame(games[Math.floor(Math.random() * (games.length))]);
	if (debug) { console.log(cDebug(" DEBUG ") + " Updated bot's game"); }
}, 800000); //change playing game every 12 minutes

//update RSS
if(rss_config.update_enable)
{
    setInterval(() => {
        console.log("[RSSFeed] Beginning Update loop");
        var sw = new Stopwatch(true);
        async.waterfall([
            function getUniqueUrls(done)
            {
                var url_array = [];
                //GET UNIQUE URLS FOR PULLING RSSES FROM, WE DO NOT WANT TO PULL MULTIPLE OF THE SAME!
                mysql_db.query("SELECT DISTINCT feed_url FROM rss_feeds",null,function(err, results, fields){
                    if(err)
                    {
                        console.error('DB Error!: ' + err.stack);
                        done(new Error(err.stack));
                        return;
                    }
                    else
                    {
                        results.forEach(function(element,index,array){
                            url_array.push(element.feed_url);
                            //console.log(element);
                        });
                        done(null, url_array);
                        return;
                    }
                });
            },
            function doGetSubChans(urls, done)
            {
                var chan_dict = {}; //dict, note the {} and not []
                //async flow is required because of stupid forEach
                //do note that since all urls are being processed together, the sequence will not be guaranteed
                //however we don't require a sequence, just the relationship between a URL and its subbed channels
                
                //process each url at the same time but keeping synchronous flow per url
                async.each(urls, function(url, done){
                    //perform select query for this url
                    chan_dict[url] = {};
                    async.parallel([
                        function doSelectChannelId(done){
                            mysql_db.query("SELECT channel_id, tags_include, tags_exclude FROM rss_feeds WHERE feed_url = ?",url,function(err, results, fields){
                                if(err)
                                {
                                    console.error('DB Error!: ' + err.stack);
                                    done(new Error(err.stack));
                                    return;
                                }
                                else
                                {
                                    //var chan_list = [];
                                    /*------------------------
                                    //channels: {
                                        [
                                        '1234' : { 
                                            tags_include: "abc",
                                            tags_exclude: "def"
                                        },
                                        '5678' : {
                                            tags_include: "None",
                                            tags_exclude: "None"
                                        }
                                        ]
                                    }
                                    ------------------------*/
                                    var chan_list = {};
                                    //process each result at the same time but keeping synchronous flow per result
                                    async.each(results, function(channel, done)
                                    {
                                        //get channel_id and push it to the list
                                        //chan_list.push(channel.channel_id);
                                        var tags_list = { 
                                            'tags_include': channel.tags_include,
                                            'tags_exclude': channel.tags_exclude
                                        };
                                        //chan_list.push(channel.channel_id);
                                        chan_list[channel.channel_id] = tags_list;
                                        //end our synchronous loop for this result
                                        done(null);
                                        return;
                                    },function(err){
                                        //we have processed all our results! we should have all the ids for this url!
                                        if(err)
                                        {
                                            done(new Error("something went wrong when forming channel list!"));
                                            return;
                                        }
                                    });
                                    //finally, set the list as value for the dict using the url as its key
                                    chan_dict[url].channels = chan_list;
                                    //console.log("[RSSFeed] Channels for "+url+" - "+chan_list);
                                    //end our synchronous loop for this url
                                    done(null);
                                    return;
                                }
                            });
                        },
                        function doSelectLastPubDate(done){
                            mysql_db.query("SELECT DISTINCT last_updated_time_utc FROM rss_feeds WHERE feed_url = ?",url,function(err, results, fields){
                                if(err)
                                {
                                    console.error('DB Error!: ' + err.stack);
                                    done(new Error(err.stack));
                                    return;
                                }
                                else
                                {
                                    chan_dict[url].last_updated_time_utc = results[0].last_updated_time_utc;
                                    //end our synchronous loop for this url
                                    done(null);
                                    return;
                                }
                            });
                        }], 
                        function(err, res)
                        {
                            if(err) done(err);
                            else done(null);
                            return;
                        });
                },function(err){
                    //we have processed all our urls! we should have the complete dict now!
                    if(!err)
                    {
                        //console.log('urls processed: ' + Object.keys(chan_dict).length);
                        //pass this dict object over to the next function for processing within this waterfall
                        done(null, chan_dict);
                        return;
                    }
                });
            },
            function doGetSendRSS(chan_dict, done)
            {
                async.each(Object.keys(chan_dict), function(url, done)
                {
                    var channels_to_send = Object.keys(chan_dict[url].channels);  //list! not a string yet!
                    var actual_url = url.substring(1, url.length - 1);
                    var lastupdatedtime_unix = chan_dict[url].last_updated_time_utc;
                    
                    //console.log(url+"->"+channels_to_send);
                    
                    async.waterfall([
                        function fetchRSS(done)
                        {
                            //console.log("->fetchRSS");
                            var feed = require("feedparser");
                            var request = require("request");
                            var fparse = new feed();
                            var data = null;
                            
                            //tell the parser which URL to parse
                            request(actual_url).pipe(fparse);
                            
                            //catch if URL cannot be read
                            fparse.on('error', function(error){
                                done(new Error(error.message));
                                return;
                            });
                            
                            fparse.on('readable', function(){
                                var stream = this;
                                data = stream.read();
                                //done(null, stream.read());
                                return;
                            });
                            
                            fparse.on('end', function(){
                                //console.log("EOS: "+actual_url);
                                done(null, data);
                                return;
                            });
                        },
                        function sendRSSMessage(item, done)
                        {
                            if(!item)
                            {
                                done(new Error("Something went wrong!"));
                                return;
                            }
                            else
                            {
                                var pubdate_unix = moment(item.pubdate).unix();
                                /*
                                if(item.categories){
                                    console.log(item.categories);
                                }*/
                                //console.log(pubdate_unix + " LAST: " + lastupdatedtime_unix);
                                if(pubdate_unix > lastupdatedtime_unix)         //if there is an update, the pubdate should be more than the last updated!
                                {
                                    console.log("[RSSFeed] " + url + " needs updating!");
                                    //async.each(chan_dict[url].channels, function(channel, done)
                                    async.each(channels_to_send, function(channel, done)
                                    {
                                        async.waterfall([
                                            function parseCategories(done)
                                            {
                                                var categories = [];
                                                for(var i = 0; i < item.categories.length; i++)
                                                {
                                                    categories.push(item.categories[i].toLowerCase());
                                                }
                                                //console.log(categories);
                                                
                                                if(categories.length > 0){
                                                    async.waterfall([
                                                        function checkIncludeTags(done)
                                                        {
                                                            var tags_include = chan_dict[url].channels[channel].tags_include;
                                                            if(tags_include != "None")
                                                            {
                                                                var tags = [];
                                                                var bFound = false;
                                                                //INCLUDE
                                                                
                                                                if(tags_include.indexOf(';') < 0){
                                                                    tags.push(tags_include);
                                                                }
                                                                else{
                                                                    tags = tags_include.split(';');
                                                                }
                                                                //console.log(tags);
                                                                //====
                                                                
                                                                for(var i = 0; i < tags.length; i++)
                                                                {
                                                                    if(categories.indexOf(tags[i]) > -1){
                                                                        bFound = true;
                                                                    }
                                                                }
                                                                
                                                                if(bFound) done(null);
                                                                else done(new Error("Item with include categories not found!"));
                                                                return;
                                                            }
                                                            else{
                                                                done(null);
                                                                return;
                                                            }
                                                        },
                                                        function checkExcludeTags(done)
                                                        {
                                                            var tags_exclude = chan_dict[url].channels[channel].tags_exclude;
                                                            if(tags_exclude != "None")
                                                            {
                                                                var tags = [];
                                                                var bFound = false;
                                                                //EXCLUDE
                                                                
                                                                if(tags_exclude.indexOf(';') < 0){
                                                                    tags.push(tags_exclude);
                                                                }
                                                                else{
                                                                    tags = tags_exclude.split(';');
                                                                }
                                                                //console.log(tags);
                                                                //====
                                                                
                                                                for(var i = 0; i < tags.length; i++)
                                                                {
                                                                    if(categories.indexOf(tags[i]) > -1){
                                                                        bFound = true;
                                                                    }
                                                                }
                                                                
                                                                if(!bFound) done(null);
                                                                else done(new Error("Item with exclude categories found!"));
                                                                return;
                                                            }
                                                            else{
                                                                done(null);
                                                                return;
                                                            }
                                                        }
                                                    ],function(err, res)
                                                    {
                                                        done(err);
                                                        return;
                                                    });
                                                }
                                                else{
                                                    done(null);
                                                    return;
                                                }
                                            },
                                            function sendHeader(done)
                                            {
                                                bot.sendMessage(channel, ":clock3:"+item.pubdate).then(msg => done(null));
                                                return;
                                            },
                                            function sendBody(done)
                                            {
                                                bot.sendMessage(channel, ":newspaper: **"+item.title+ "** - " + item.link+"\nTags: **"+item.categories+"**", function() {
                                                    var text = htmlToText.fromString(item.description,{
                                                        wordwrap:true,
                                                        ignoreHref:true
                                                    });
                                                    bot.sendMessage(channel,text+"\n\n");                    
                                                });
                                                done(null);
                                                return;
                                            }
                                        ], function(err, res){return;});
                                        done(null);
                                        return;
                                    },function(err){
                                        //we have sent all our RSSes!
                                        if(!err)
                                        {
                                            //console.log("[RSSFeed] channels processed for: " + url);
                                            done(null, pubdate_unix);
                                            return;
                                        }
                                        else{
                                            console.log("[RSSFeed] shit happened!");
                                            done(err);
                                            return;
                                        }
                                    });
                                }
                                else
                                {
                                    console.log("[RSSFeed] " + url + " does not need updating!");
                                    done(null, pubdate_unix);
                                    return;
                                }
                            }
                            
                        },
                        function updateLastUpdatedTime(pubdate_unix, done)
                        {
                            //console.log("->updateLastUpdatedTime");
                            mysql_db.query("UPDATE rss_feeds SET last_updated_time_utc = ? WHERE feed_url = ?",[pubdate_unix, url],function(err, result){
                                if(err)
                                {
                                    console.error('DB Error!: ' + err.stack);
                                    done(new Error(err.stack));
                                    return;
                                }
                                else
                                {
                                    //console.log("UPDATE Affected rows: "+result.affectedRows);
                                    done(null, "[RSSFeed] url db updated: "+url);
                                    return;
                                }
                            });
                        }
                    ],function(err,res){
                        if(err) done(err);
                        else done(null);
                        return;
                    });
                },function(err){
                    if(!err)
                    {
                        //done(null, chan_dict);
                        done(null);
                        return;
                    }
                });
            }
        ],function(err,res){
            if(!err){
                sw.stop();
                console.log("[RSSFeed] Done loop - elapsed: "+ Math.round(sw.read()) / 1000 + "s");
            }
        });           
    }, rss_config.update_duration);
}

setInterval(() => {
	remind.checkReminders(bot);
}, 30000);

if (config.carbon_key) {
	setInterval(()=>{
		request.post({
				"url": "https://www.carbonitex.net/discord/data/botdata.php",
				"headers": {"content-type": "application/json"}, "json": true,
				body: {
					"key": config.carbon_key,
					"servercount": bot.servers.length
				}
			}, (e, r)=>{
			if (config.debug) console.log(cDebug(" DEBUG ") + " Updated Carbon server count");
			if (e) console.log("Error updating carbon stats: " + e);
			if (r.statusCode !== 200) console.log("Error updating carbon stats: Status Code " + r.statusCode);
		});
	}, 3600000);
}
