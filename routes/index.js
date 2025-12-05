var express = require('express');
var router = express.Router();


router.get('/hello', function(req, res, next) {
    res.send('hello');
});
/* GET home page. */


router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
