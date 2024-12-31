var _ = require('lodash');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');

var router = express.Router();

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

var http = require('http');
var https = require('https');
var querystring = require('querystring');
const util = require('util');

var express_port = 8080;

const BigNumber = require('bignumber.js');

const getBestFrenPetByOwner = (address) => {
  var rest_options = {
    host: 'api.frenpet.xyz',
    port: 443,
    path: '/',
    headers : { 'Content-Type': 'application/json' },
    method: 'POST'
  }
  var post_data = {
    'query': `
       query GetPetsByOwner {
         pets(where: { owner: "${address}" },orderBy: "scoreInt", orderDirection: "desc") {
           items {
             id
             createdAt
             dna
             name
             owner
             attackPoints
             defensePoints
             score
             status
             lastAttackUsed
             lastAttacked
             level
             timeUntilStarving
             rewards
           }
         }
       }`
  }
  return new Promise ((resolve, reject) => {
    var request = https.request(rest_options, (response) => {
      var content = "";
      response.on('data', function(chunk) {
        content += chunk;
      });
      response.on('end', function() {
        if (content.startsWith('<'))
          reject('Invalid response from API server.');
        var data = JSON.parse(content);
        if (data.data.pets.items[0] != undefined) {
          resolve(data.data.pets.items[0]);
        }
        else {
          resolve(null);
        }
      });
    });
    request.write(JSON.stringify(post_data));
    request.on('error', function(error) {
      reject(error);
    });
    request.end();
  });
}

const getFrenPetById = (id) => {
  var rest_options = {
    host: 'api.frenpet.xyz',
    port: 443,
    path: '/',
    headers : { 'Content-Type': 'application/json' },
    method: 'POST'
  }
  var post_data = {
    'query': `
       query GetPetById {
         pet(id: ${id}) {
           id
           createdAt
           dna
           name
           owner
           attackPoints
           defensePoints
           score
           status
           lastAttackUsed
           lastAttacked
           level
           timeUntilStarving
           rewards
           itemsOwned {
             items {
               id
               owned
               itemEquipExpires
             }
           }
         }
       }`
  }
  return new Promise ((resolve, reject) => {
    var request = https.request(rest_options, (response) => {
      var content = "";
      response.on('data', function(chunk) {
        content += chunk;
      });
      response.on('end', function() {
        if (content.startsWith('<'))
          reject('Invalid response from API server.');
        var data = JSON.parse(content);
        if (data.data.pet != undefined) {
          resolve(data.data.pet);
        }
        else {
          resolve(null);
        }
      });
    });
    request.write(JSON.stringify(post_data));
    request.on('error', function(error) {
      reject(error);
    });
    request.end();
  });
}

const formatScore = (score) => {
  var rawScore = new BigNumber(score);
  var displayScore = rawScore.div(1000000000000);
  return Math.round(parseFloat(displayScore.toFixed()));
}

router.route('/pet/:addressId')
  .get((req, res) => {
    var addressId = req.params.addressId;
    var eth_regex = /^0x[a-fA-F0-9]{40}$/;
    var eth_address = 0;
    (async () => {
      if (eth_regex.test(addressId)) {
        eth_address = 1;
      }

      try {
        if (eth_address == 1)
          var pet = await getBestFrenPetByOwner(addressId);
        else if (Number.isInteger(parseInt(addressId))) {
          var pet = await getFrenPetById(addressId);
        }
        else {
          res.render('index', { petName: 'invalid input',
                                petImage: 'https://fp.cabbit.dev/assets/pets/ghost-bg.png',
                                petUrl: 'https://pet.game',
                                petStats: '' });
          return;
        }

        if (pet == null && eth_address == 1) {
          res.render('index', { petName: 'eth address does not have any pets',
                                petImage: 'https://fp.cabbit.dev/assets/pets/ghost-bg.png',
                                petUrl: 'https://pet.game',
                                petStats: '' });
          return;
        }
        else if (pet == null) {
          res.render('index', { petName: 'pet does not exist',
                                petImage: 'https://fp.cabbit.dev/assets/pets/ghost-bg.png',
                                petUrl: 'https://pet.game',
                                petStats: '' });
          return;
        }
        else {
          var unixTime = Math.floor(Date.now() / 1000);
          var daysOld = Math.floor((unixTime - parseInt(pet.createdAt)) / 86400);
          var timeToStarve = parseInt(pet.timeUntilStarving) - unixTime;
          var petDescription = 'Starving';
          if (timeToStarve > 0) {
            var daysLeft = Math.floor(timeToStarve / 86400);
            var hoursLeft = Math.floor((timeToStarve % 86400) / 3600);
            var minutesLeft = Math.floor((timeToStarve % 3600) / 60);
            var secondsLeft = Math.floor(timeToStarve % 60);
            petDescription = daysLeft + 'D ' + hoursLeft + 'h ' + minutesLeft + 'm ' + secondsLeft + 's';
          }
          if (pet.dna[0] > 5) {
            pet.dna[1] = pet.dna[0];
            pet.dna[2] = pet.dna[0];
          }
          var petFile = pet.dna[0] + '-' + pet.dna[1] + '-' + pet.dna[2] + '-bg.png';
          if (pet.status == 4) {
            petFile = 'ghost-bg.png';
            petDescription = 'DED';
            daysOld = 0;
          }
          else if (pet.status == 5) {
            petDescription = 'Hibernating';
          }
          var name = pet.name + ' (' + pet.id + ')';
          var image = 'https://fp.cabbit.dev/assets/pets/' + petFile;
          var url = 'https://pet.game/pet/' + pet.id;
          var stats = petDescription + '; Points: ' + formatScore(pet.score).toString() + '; ATK: ' + pet.attackPoints.toString() + '; DEF: ' + pet.defensePoints.toString() + '; Days Old: ' + daysOld.toString();
          res.render('index', { petName: name,
                                petImage: image,
                                petUrl: url,
                                petStats: stats });
        }
      } catch(error) {
        res.render('index', { petName: 'unknown error',
                              petImage: 'https://fp.cabbit.dev/assets/pets/ghost-bg.png',
                              petUrl: 'https://pet.game',
                              petStats: '' });
        console.log(error);
      }
    })();
  });

app.use('/', router);
app.listen(express_port, function() {
  console.log("Express server listening on port %d in %s mode", express_port, app.get('env'));
});
