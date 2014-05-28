try {

  var DataBase = require('./class/initial.js');
  var Live = DataBase.Live,
      Mobile = DataBase.Mobile,
      Release = DataBase.Release;

  var Push = Mobile.Object.extend("push");

  var query = new Mobile.Query(Push);
  query.lessThanOrEqualTo('start', new Date());
  query.limit(20);
  query.find({
    success: function(pushs) {
      var list = [];
      pushs.forEach(function(push){
        list.push({
          'title': push.get('title') || '',
          'message': push.get('message') || '',
          'link': push.get('link') || '',
          'datetime': push.get('start').getTime() || '',
        })
        console.log(push.get('start').getTime());
      });
      Release.child('notify').set(list, function(){
        console.log(new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,'') + ' Push Run! ');
        process.exit(0);
      });
    },
    error: function(error) {
        throw "Fetch Push Error: " + error.code + " " + error.message;
    }
  });

}
catch(err) {
  console.log('ERROR( ' + new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,'') + ' ): ', err);
}

// // JSON.parse(decodeURIComponent(escape(atob('eyJ0eXBlIjoibGl2ZSIsInVybCI6InVybCIsInRpdGxlIjoi5oiR5oSb5Y+w54GjIn0='))))