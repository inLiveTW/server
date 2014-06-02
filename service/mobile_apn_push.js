var async = require('async');
var https = require('apn');

try {

  var DataBase = require('./class/initial.js');
  var Live = DataBase.Live;

  var Push = Mobile.Object.extend("push");
  var Chrome_Token = Live.Object.extend("chrome_token");

  var sendNotify = function(task, cb) {
  }

  var queue = async.queue(function (task, callback) {
    sendNotify(task, callback);
  }, 5);

  var query = new Mobile.Query(Push);
  query.lessThanOrEqualTo('start', new Date());
  query.equalTo('chrome', undefined);
  query.find({
    success: function(pushs) {
      async.eachSeries(pushs, function (push, cb) {
            var qToekn = new Live.Query(Chrome_Token);
                qToekn.equalTo("channel", push.get('type')+'');
                qToekn.find({
                  success: function(tokens) {
                    var count = tokens.length;
                    if (count < 1) {
                      console.log('No device: ', push.get('title'), push.get('message'));
                      push.set('chrome', new Date());
                      push.save().then(cb, cb);
                    }else{
                      console.log('Push start: ', push.get('title'), push.get('message'));
                      tokens.forEach(function(token){
                        queue.push({
                            'access': access,
                            'token': token.get('token'),
                            'title': push.get('title'),
                            'message': push.get('message'),
                            'link': push.get('link'),
                          }, function (err, task) {
                            console.log('completed!', task.token);
                            count -= 1;
                            if ( count < 1 ) {
                              console.log('Push end: ', push.get('title'), push.get('message'));
                              push.set('chrome', new Date());
                              push.save().then(cb, cb);
                            }
                        });
                      });
                    }
                  },
                  error: function(error) {
                    console.log('Get Chrome Token Error: ', error.code, ' ', error.message);
                    cb();
                  }
                });
          }, function () {
            process.exit(0);
          });
        },
        error: function(error) {
            throw "Fetch Push Error: " + error.code + " " + error.message;
        }
      });
    }
  });
}
catch(err) {
  console.log('ERROR( ' + new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,'') + ' ): ', err);
}

// // JSON.parse(decodeURIComponent(escape(atob('eyJ0eXBlIjoibGl2ZSIsInVybCI6InVybCIsInRpdGxlIjoi5oiR5oSb5Y+w54GjIn0='))))


var workload = 0,
    worker, listen;

function getDateTime() {
    var date = new Date();

    var hour = date.getHours();
    hour = (hour < 10 ? '0' : '') + hour;
    var min  = date.getMinutes();
    min = (min < 10 ? '0' : '') + min;
    var sec  = date.getSeconds();
    sec = (sec < 10 ? '0' : '') + sec;

    var month = date.getMonth() + 1;
    month = (month < 10 ? '0' : '') + month;
    var day  = date.getDate();
    day = (day < 10 ? '0' : '') + day;

    return month + '-' + day + ' ' + hour + ':' + min + ':' + sec;
}

var log = function(){
    console.log('[APNS] ' + getDateTime() + ' ' + Array.prototype.join.call(arguments, ' '));
}

var error = function(){
    console.error('[APNS] ' + getDateTime() + ' ' + Array.prototype.join.call(arguments, ' '));
}

log('Family APNS send restart!!!');

var connection = mysql.createConnection({
    host     : '127.0.0.1',
    user     : 'pns',
    password : 'VFVHKQC7',
    database : 'pns',
    charset  : 'latin1',
    insecureAuth: true
});

// var connection = mysql.createConnection({
//     host     : '127.0.0.1',
//     user     : 'root',
//     password : '',
//     database : 'family',
//     charset  : 'latin1'
// });

connection.connect();

process.on('message', function(msg) {
  if (msg == 'shutdown') {
    workload = 999;
  }
});

(wroker = function (task, callBack) {
    var service;

    if ( task.mode == 'D' ) {
        service = new apn.Connection({
          gateway: 'gateway.sandbox.push.apple.com',
          cert: task.key,
          key: task.key
        });
    }else{
        service = new apn.Connection({
          address: 'gateway.push.apple.com',
          cert: task.key,
          key: task.key
        });
    }

    var token = {};
    var target = [];
    var completed = [];
    var failed = {};
    var request_id = task.request_id;
    var ready_cb, sent_cb;

    service
        .on('connected', function() {
            log("Service Connected", request_id);
        })
        .on('timeout', function () {
            log("Service Connection Timeout", request_id);
        })
        .on('disconnected', function() {
            log("Disconnected from APNS", request_id);
        })
        .on('socketError', console.error);


    var transmitted = function(err, device){
        var send_id, index, target_index;

        clearTimeout(ready_cb);

        if ( token && device ) {
            send_id = token[device.toString()];
            target_index = target.indexOf(device.toString());
            target.splice(target_index, 1);
        }

        if ( send_id > 0 ) {
            if ( err === null ){
                completed.push(send_id);
            }else{

                index = completed.indexOf(send_id);

                if ( index > -1 ){
                    completed.splice(index, 1);
                }

                if ( ! failed[err] ) {
                    failed[err] = [];
                }

                failed[err].push(send_id);
            }
        }

        if ( err !== null ){
            if ( device ) {
                error("Service error: " + err, "request_id: " + request_id, " for device ", device.toString());
            }else{
                error("Service error: " + err, "request_id: " + request_id);
            }
        }

        if ( sent_cb !== true ) {
            ready_cb = setTimeout(function(){
                sent_cb = true;

                for(var i=0, length=target.length; i < length; i+=1){
                    if ( target[i] ) {
                        if ( ! failed[500] ) {
                            failed[500] = [];
                        }
                        failed[500].push(token[target[i]]);
                    }
                }

                callBack(completed, failed);

                delete token;
                delete target;
                delete completed;
                delete failed;

            }, 2000);
        }
    }

    service.on('transmitted', function(notification, device) {
        transmitted(null, device);
    });

    service.on('transmissionError', function(errCode, notification, device) {
        transmitted(errCode, device);
    });

    connection.query("SELECT `apns_send`.`token`, `apns_send`.`apns_send_id` FROM `apns_send` WHERE `apns_request_id` = '" + request_id + "' AND `status_code`='0' LIMIT 1000", function(err, rows, fields) {
        if (err) {
            error('SQL: select `apns_send`', err);
            return;
        }

        var device;
        for (var i = 0, length = rows.length; i < length; i+=1) {
            device = rows[i];
            token[device.token.toLowerCase()] = device.apns_send_id;
            target.push(device.token.toLowerCase());
        };
        log('Ready to Send APNS', request_id, 'length: ' + target.length);

        if ( target.length < 1 ) {
            callBack([], []);
            return;
        }

        var note = new apn.notification();
        note.payload = task.message;

        service.pushNotification(note, target);
    });

});

var listen;
(listen = function(){

    connection.query("SELECT `apns_request`.`apns_request_id`, `apns_request`.`payload`, `app`.`apns_cert`, `app`.`app_mode` FROM `apns_request` JOIN `app` ON `apns_request`.`app_id` = `app`.`app_id` WHERE `apns_request`.`status` IN (2,3) AND `apns_request`.`start_time` < NOW() LIMIT 5", function(err, rows, fields) {
        if (err) {
            error('SQL: select `apns_request` & `app_id`', err);
            process.exit(1);
        }

        var request = [];
        for (var i = 0, length = rows.length; i < length; i+=1) {
            request.push({
                request_id: rows[i].apns_request_id,
                key: rows[i].apns_cert,
                message: JSON.parse(rows[i].payload),
                mode: rows[i].app_mode
            });
        };

        async.map(request, function(item, callBack){
            var request_id = item.request_id;
            wroker(item, function(completed, failed){
                var completed_length = completed.length;
                var failed_length = 0;

                var update_to_database = [];

                if ( completed && completed.length ) {
                    update_to_database.push(function(callBack){
                        connection.query("UPDATE `apns_send` SET `status_code`='2', `send_time`=NOW() WHERE `apns_send_id` IN ('" + completed.join("','") + "')", function(err){
                            if (err) {
                                error('SQL: update for completed', err);
                            }
                            callBack(null);
                        });
                    });
                }

                if ( failed ) {
                    for ( return_code in failed ) {
                        (function(code, list){
                            update_to_database.push(function(callBack){
                                connection.query("UPDATE `apns_send` SET `status_code`='3', `send_time`=NOW(), `return_code`='" + code + "' WHERE `apns_send_id` IN ('" + list.join("','") + "')", function(err){
                                    if (err) {
                                        error('SQL: update for failed', err);
                                    }
                                    callBack(null);
                                });
                            });
                        })(return_code, failed[return_code]);
                        failed_length += failed[return_code].length;
                        log('Send Failed', request_id, 'Code:', return_code, 'Length:', failed[return_code].length);
                    }
                }
                log('Send Completed', request_id, 'Completed:', completed_length, ' Failed:', failed_length);

                async.parallel(update_to_database, function(err, results) {
                    log('Completed & Update Database', request_id);
                    connection.query("UPDATE `apns_request` SET `completed`=`completed`+" + completed_length + ", `failed`=`failed`+" + failed_length + " WHERE `apns_request_id` = '" + request_id + "'", function(err){
                        if (err) {
                            error('SQL: update for request', err);
                        }
                        callBack(null, {
                            request_id: item.request_id,
                            completed: completed_length,
                            failed: failed_length
                        });
                    });
                });
            });
        }, function(err, results){
            var count = 0;

            async.map(results, function(req, cb){
                if ( req.completed + req.failed < 1 ) {
                    connection.query("UPDATE `apns_request` SET `status`='7', `end_time`=NOW() WHERE `apns_request_id`='" + req.request_id + "'", function(err){
                        if (err) {
                            error('SQL: update for end', err);
                        }
                        cb(null);
                    });
                }else{
                    cb(null);
                }
            }, function(err) {
                for (var i = 0, length = results.length; i < length; i+=1) {
                    count += results[i].completed || 0;
                    count += results[i].failed || 0;
                };

                workload += 1;
                if ( workload > 300 ) {
                    process.exit(0);
                }else if ( count < 1 ) {
                    setTimeout(listen, 10000);
                }else{
                    setTimeout(listen, 300);
                }
            });
        });
    });

})();
