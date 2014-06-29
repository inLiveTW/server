var async = require('async');

try {

  var DataBase = require('../class/initial.js');
  var Live = DataBase.Live,
      Mobile = DataBase.Mobile,
      ReleaseData = DataBase.ReleaseData;

  var Push4Mobile = Mobile.Object.extend("push");
  var Push4Live = Live.Object.extend("push");

  var push_type = {
    'message': '即時訊息',
    'event': '事件提醒',
    'reporter': '公民記者',
    'live': '節目開播',
  }

  async.series([
    function(cb){
      var qPush4Mobile = new Mobile.Query(Push4Mobile);
      qPush4Mobile.find({
        success: function(pushs) {
          async.each(pushs, function(item, cb){
            var push = new Push4Live();
            push.save({
              'name': item.get('name') || '',
              'type': item.get('type') || '',
              'message': item.get('message') || '',
              'link': item.get('link') || '',
              'start': new Date(item.get('start')) || '',
            }, {
              success: function(push) {
                item.destroy({
                  success: function(push) {
                    cb();
                  },
                  error: function(push, error) {
                    console.log("Delete push from mobile error: " + error.code + " " + error.message);
                  }
                });
              },
              error: function(push, error) {
                console.log("Save push from mobile to live error: " + error.code + " " + error.message);
                cb();
              }
            });
          }, cb);
        },
        error: function(errror) {
          console.log("Fetch push for mobile error: " + error.code + " " + error.message);
          cb();
        }
      });
    },
    function(){
      var qPush4Live = new Live.Query(Push4Live);
      qPush4Live.lessThanOrEqualTo('start', new Date());
      qPush4Live.descending('start');
      qPush4Live.limit(20);
      qPush4Live.find({
        success: function(pushs) {
          console.log(pushs);
          var list = [];
          pushs.forEach(function(push){
            list.push({
              'title': '『' + (push_type[push.get('type')] || '其他通知') + '』',
              'message': push.get('message') || '',
              'name': push.get('name'),
              'link': push.get('link') || '',
              'datetime': push.get('start').getTime() || '',
            })
          });

          list.sort(function(x,y){
            return ( x.datetime < y.datetime) ? 1 : -1;
          });

          ReleaseData.child('notify').set(list, function(){
            console.log(new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,'') + ' Push Run! ' + list.length);
            process.exit(0);
          });
        },
        error: function(error) {
            throw "Fetch Push Error: " + error.code + " " + error.message;
        }
      });
    }
  ], function(){
    process.exit(0);
  });
}
catch(err) {
  console.log('ERROR( ' + new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,'') + ' ): ', err);
}

// // JSON.parse(decodeURIComponent(escape(atob('eyJ0eXBlIjoibGl2ZSIsInVybCI6InVybCIsInRpdGxlIjoi5oiR5oSb5Y+w54GjIn0='))))