var https = require('https'),
    async = require('async'),
    RRule = require('rrule').RRule;
    
try {

  var DataBase = require('../class/initial.js');
  var Release = DataBase.Release;

  var parser = function (cb){
    var date = new Date().toISOString();

    var source = [
      'https://www.googleapis.com/calendar/v3/calendars/s6jage479tquhj3mr7abhecs48%40group.calendar.google.com/events?key=AIzaSyBqSFbeQLYKQl80FblMuj682zvpbpPVG_o&timeZone=Asia/Taipei&timeMin='+date,
      'https://www.googleapis.com/calendar/v3/calendars/ptt.publicissue%40gmail.com/events?key=AIzaSyBqSFbeQLYKQl80FblMuj682zvpbpPVG_o&timeZone=Asia/Taipei&timeMin='+date,
    ];

    async.map(source, function (url, cb) {
      https.get(url, function(res) {
        var body = '';
        res.on('data', function(chunk) {
          body += chunk;
        });
        res.on('end', function() {
          var list = JSON.parse(body).items || [];
          cb(null, list);
        });
      }).on('error', function(e) {
        cb(null, []);
      });
    }, function (err, results) {
      var events = {};
      var count = 0;

      results.forEach(function (list) {
        list.forEach(function (item) {
          var start = 
            item.start && (item.start.date && item.start.date + 'T00:00:00+08:00' || item.start.dateTime)
            || new Date(new Date().getTime()+8*60*60*1000).toISOString().replace(/\..+/gi,'+08:00');

          if ( item.recurrence ) {
            var opt = RRule.parseString((item.recurrence+'').replace('RRULE:',''))
                opt.dtstart = new Date(start);
            var next = new RRule(opt).between(new Date(), new Date(Date.now()+14*24*60*60*1000));
            if ( ! next.length ) {
              return ;
            }else{
              start = new Date(new Date(next[0]).getTime()+8*60*60*1000).toISOString().replace(/\..+/gi,'+08:00');
            }
          }

          var eData = {}
          var attr = (item.description || '').match(/\[[^\]]+\][^\n]+/gi);
          if ( attr ) {
            attr.forEach(function(info){
              info = /\[([^\]]+)\]([^\n]+)/i.exec(info);
              if (info) {
                eData[info[1].trim()] = info[2].trim();
              }
            });
          }

          eData['type'] = 'google';
          eData['day'] = item.start && item.start.date ? true : false;
          eData['start'] = start;
          eData['end'] = item.end && (item.end.date && item.end.date + 'T00:00:00+08:00' || item.end.dateTime) || '';
          eData['title'] = item.summary || '';
          eData['location'] = item.location || '';
          eData['link'] = eData['link'] || item.htmlLink;

          if (item.summary) {
            events['google_' + item.id] = eData;
          }

          count += 1;
        });
      });

      Release.child('event').set(events, function(){
        cb(null, count);
      });
    });
  };

  parser(function (err, count) {
    console.log(new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,'') + ' Calendar Run!', count);
    process.exit(0);
  });

}
catch(err) {
    console.log('ERROR( ' + new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,'') + ' ): ', err)
}
