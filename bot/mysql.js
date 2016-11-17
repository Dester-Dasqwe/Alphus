var mysql = require('mysql');
var mysql_settings = require('../db/mysql_settings.json');
checkConfig();

var mysql_conn = null;

function checkConfig() {
	if (mysql_settings.db_type === null) { console.log(colors.cWarn(" WARN ") + "DBType not specified. Defaulting to 'mysql'"); mysql_settings.db_type = 'mysql'; }
	if (mysql_settings.db_host === null) { console.log(colors.cWarn(" WARN ") + "DBHost not defined. Defaulting to 'localhost'"); mysql_settings.db_host = 'localhost'; }
    if (mysql_settings.db_port === null) { console.log(colors.cWarn(" WARN ") + "DBPort not defined. Defaulting to '3306'"); mysql_settings.db_port = '3306'; }
	if (mysql_settings.db_username === null) { console.log(colors.cWarn(" WARN ") + "DBUsername not defined. Will connect anonymously"); mysql_settings.db_username = ''; }
	if (mysql_settings.db_password === null) { console.log(colors.cWarn(" WARN ") + "DBPassword not defined. Will connect anonymously"); mysql_settings.db_password = ''; }
    if (mysql_settings.db_dbname === null) { console.log(colors.cWarn(" WARN ") + "Database not defined. Please check your settings"); }
}

function createConnection() {
    mysql_conn = mysql.createConnection({
        host: mysql_settings.db_host,
        port: mysql_settings.db_port,
        user: mysql_settings.db_username,
        password: mysql_settings.db_password,
        database: mysql_settings.db_dbname
    });
}

exports.testDb = function(callback) {
    createConnection();
    //EXECUTE EVERYTHING, THEN CALLBACK THE FUNCTION IF AN ERROR HAPPENS
    mysql_conn.connect(function(err) {
        //IF ERROR
        if (err) {
            console.error('DB error connecting: ' + err.stack);
            testresult = false;
        }
        //IF NO ERROR
        else
        {
            console.log('DB connected as threadid ' + mysql_conn.threadId);
            mysql_conn.end(function(err) {
                console.log('DB threadid ' + mysql_conn.threadId + ' exited!');
            });
            testresult = true;
        }
        //FINALLY, CALL THE CALLBACK OF THE TESTDB FUNCTION WITH THE SUCCESS CODE PASSED IN
        callback(testresult);
    });
};

exports.query = function(sqlquery, sqlitems, callback) {
    createConnection();
    var query = mysql_conn.query(sqlquery, sqlitems, function (error, results, fields) {
        callback(error, results, fields);
    });
    mysql_conn.end(function(err) {});
    //console.log('Last SQL: '+query.sql);
};