// index.js

var express = require('express');
var app = express();
var bodyParser = require('body-parser');

var token;

var request = require('request');
var pdRequest = request.defaults({
	headers: { 
		"Content-type": "application/json",
		"Accept": "application/vnd.pagerduty+json;version=2",
		"Authorization": "Token token=" + token
	}
});

var message_type_strings = {
	'incident.trigger': 'triggered',
	'incident.acknowledge': 'acknowledged',
	'incident.escalate': 'escalated',
	'incident.resolve': 'resolved',
	'incident.unacknowledge': 'unacknowledged',
	'incident.assign': 'reassigned',
	'incident.delegate': 'delegated'
};

var AWS = require('aws-sdk');


app.set('port', (process.env.PORT || 5000));

app.use(bodyParser.json());

function getTriggerLE(token, triggerURL, callback) {
	var options = {
		headers: { 
			"Content-type": "application/json",
			"Accept": "application/vnd.pagerduty+json;version=2",
			"Authorization": "Token token=" + token
		},
		uri: triggerURL,
		method: "GET",
		qs: {
			"include[]": "channels"
		}
	}
	request(options, function(error, response, body) {
		if ( ! response.statusCode || response.statusCode < 200 || response.statusCode > 299 ) {
			console.log("Error getting trigger log entry: " + error + "\nResponse: " + JSON.stringify(response, null, 2) + "\nBody: " + JSON.stringify(body, null, 2));
		} else {
			var trigger = JSON.parse(body);
			callback(trigger);
		}
	});
}

function getEP(epID, buttonPusherID, incidentID, incidentTitle) {
	var options = {
		headers: { 
			"Content-type": "application/json",
			"Accept": "application/vnd.pagerduty+json;version=2",
			"Authorization": "Token token=" + token
		},
		uri: "https://api.pagerduty.com/escalation_policies/" + epID,
		method: "GET",
		qs: {
			"include[]": "targets"
		}
	}

	request(options, function(error, response, body) {
		if ( ! response.statusCode || response.statusCode < 200 || response.statusCode > 299 ) {
			console.log("Error getting EP: " + error + "\nResponse: " + JSON.stringify(response, null, 2) + "\nBody: " + JSON.stringify(body, null, 2));
		} else {
			var ep = JSON.parse(body);
			var targets = [];
			ep.escalation_policy.escalation_rules.forEach(function(rule) {
				console.log("Rule " + rule.id);
				rule.targets.forEach(function(target) {
					console.log("Target " + target.id);
					if ( target.type == "user" ) {
						console.log("User " + target.id);
						if ( targets.indexOf(target.id) == -1 ) {
							targets.push(target.id);
						}
					} else if ( target.type == "schedule" ) {
						console.log("Schedule " + target.id);
						target.users.forEach(function(user) {
							console.log("User " + user.id + "(" + user.summary + ")");
							if ( targets.indexOf(user.id) == -1 ) {
								targets.push(user.id);
							}
						});
					}
				});
			});
			console.log(JSON.stringify(targets, null, 4));

			for (var i = 0; i < targets.length; i++ ) {
				var userID = targets[i];
				targets[i] = {
					responder_request_target: {
						id: userID,
						type: "user_reference"
					}
				}
			}
			var message = "Please help with incident " + incidentTitle;
			
			while ( targets.length > 0 ) {
				addResponders(message, targets.splice(0,1), incidentID, buttonPusherID);
			}
		}
	});
}

function addNote(token, incidentURL, fromEmail, note){
	var body = {
		"note": {
			"content": note
		}
	};
	var options = {
		headers: { 
			"Content-type": "application/json",
			"Accept": "application/vnd.pagerduty+json;version=2",
			"Authorization": "Token token=" + token,
			"From": fromEmail
		},
		uri: incidentURL + "/notes",
		method: "POST",
		json: body
	};
	request(options, function(error, response, body) {
		if ( ! response.statusCode || response.statusCode < 200 || response.statusCode > 299 ) {
			console.log("Error adding note: " + error + "\nResponse: " + JSON.stringify(response, null, 2) + "\nBody: " + JSON.stringify(body, null, 2));
		}
	});
}

function addResponders(message, targets, incidentID, buttonPusherID) {

	var body = {
		"message": message,
		"responder_request_targets": targets,
		"requester_id": buttonPusherID
	};

	var options = {
		headers: { 
			"Content-type": "application/json",
			"Accept": "application/vnd.pagerduty+json;version=2",
			"Authorization": "Token token=" + token
		},
		uri: "https://api.pagerduty.com/incidents/" + incidentID + "/responder_requests",
		method: "POST",
		json: body
	};
	
	request(options, function(error, response, body) {
		if ( ! response.statusCode || response.statusCode < 200 || response.statusCode > 299 ) {
			console.log("Error adding responders: " + error + "\nResponse: " + JSON.stringify(response, null, 2) + "\nBody: " + JSON.stringify(body, null, 2));
		} else {
			console.log("Added " + targets.length + " responders to incident " + incidentID);
		}
	});	
}

//added kieran
function addTag(token, incident){
	console.log("Calling addTag method");
	var body = {
		"incident": {
		    "type": "incident_reference",
		    "priority": {
		    "id": "PWR861O",
		    "type": "priority",
		    "self": "https://api.pagerduty.com/priorities/PWR861O"
			}
			}
		};
	var options = {
		headers: { 
			"Content-type": "application/json",
			"Accept": "application/vnd.pagerduty+json;version=2",
			"From":"kieran@pagerduty.com",
			"Authorization": "Token token=" + token
		},
		uri: "https://api.pagerduty.com/incidents/" + incident.id,
		//uri: "https://api.pagerduty.com/incidents/PG34N9G",
		method: "PUT",
		json: body
	};
	
	console.log("uri for post "+ "https://api.pagerduty.com/incidents/" + incident.id);
	console.log("options "+JSON.stringify(options));
	
	
	request(options, function(error, response, body) {
		if ( ! response.statusCode || response.statusCode < 200 || response.statusCode > 299 ) {
			console.log("Error adding priority: " + error + "\nResponse: " + JSON.stringify(response, null, 2) + "\nBody: " + JSON.stringify(body, null, 2));
		}
	});
}

app.post('/addtags', function(req, res) {
	
	console.log("calling add tag");
	var incident = req.body.messages[0].incident;
	//var service = req.body.messages[0].incident.service.name
	var token = req.query.token;
	//var tag_id = req.query.tag;
	var event = req.body.messages[0].event;
	//var incidentURL = req.body.messages[0].incident.self;
	console.log("this is my incident "+incident.id);
	//console.log("this is my tag id "+ tag_id);
	addTag(token, incident);
	

	//I don't need this extra code KG
	getTriggerLE(token, incident.first_trigger_log_entry.self, function(logEntry) {
		console.log("event type: " + event );
		
		if ( event == 'incident.acknowledge' ) {
			addTag(token, incident);
		
		} else {
			res.end();
			return;
		}
		
		
	});

	res.end();
});

//end kieran

app.post('/allhands', function (req, res) {
	token = req.query.token;
	var requesterID;
	
	req.body.messages.forEach(function(message) {

		try {
			if ( message.log_entries[0].agent.type == 'user_reference' ) {
				requesterID = message.log_entries[0].agent.id;				
			}
		}
		catch (e) {
		}
		
		if ( ! requesterID ) { 
			requesterID = req.query.requester_id;
		}

		if ( message.event == "incident.custom" || message.event == "incident.trigger" ) {
			getEP(message.incident.escalation_policy.id, requesterID, message.incident.id, message.incident.title);	
		}
	});
	res.end();
});

app.post('/awsconsole', function (req, res) {
	
	try {
		var incidentTitle = req.body.messages[0].incident.title;
		var incidentURL = req.body.messages[0].incident.self;
		
		getTriggerLE(req.query.token, req.body.messages[0].incident.first_trigger_log_entry.self, function(logEntry) {
			var region = logEntry.log_entry.channel.cef_details.source_location;
			var instanceID = logEntry.log_entry.channel.cef_details.source_component;
			var creds = new AWS.Credentials({
				accessKeyId: req.query.awsAccess,
				secretAccessKey: req.query.awsSecret
			});
			
			var ec2 = new AWS.EC2({
				region: region,
				credentials: creds
			});
		
			var params = {
				InstanceId: instanceID
			};
			ec2.getConsoleOutput(params, function(err, data) {
				if (err) {
					console.log(err, err.stack);
				} else {
					var buf = Buffer.from(data.Output, 'base64');
					var output = buf.toString('ascii');
					var lines = output.split('\n');
					var tail = lines.slice(-10);
					var note = tail.join('\n');
					note = note.replace(/(.{80})/g, "$1\n");
					addNote(req.query.token, incidentURL, req.query.fromEmail, note);
				}
			});
		});
	}
	catch (e) {
		console.log(e.message);
	}
	finally {
		res.end();
	}
});

app.post('/awsreboot', function(req, res) {
	try {
		var incidentURL = req.body.messages[0].incident.self;
	
		getTriggerLE(req.query.token, req.body.messages[0].incident.first_trigger_log_entry.self, function(logEntry) {
			var region = logEntry.log_entry.channel.cef_details.source_location;
			var instanceID = logEntry.log_entry.channel.cef_details.source_component;
			var creds = new AWS.Credentials({
				accessKeyId: req.query.awsAccess,
				secretAccessKey: req.query.awsSecret
			});

			var ec2 = new AWS.EC2({
				region: region,
				credentials: creds
			});
		
			var params = {
				InstanceIds: [ instanceID ]
			};
			ec2.rebootInstances(params, function(err, data) {
				if (err) {
					console.log(err, err.stack);
				} else {
					var note = "Reboot requested for instance " + instanceID;
					addNote(req.query.token, incidentURL, req.query.fromEmail, note);
				}
			});
		});
	}
	catch (e) {
		console.log(e.message);
	}
	finally {
		res.end();
	}
});


app.post('/whatsapp', function(req, res) {
	var instance_id = req.query.instance_id;
	var client_id = decodeURIComponent(req.query.client_id);
	var client_secret = req.query.client_secret;
	var group_admin = req.query.group_admin;
	var group_name = decodeURIComponent(req.query.group_name);
	var url = 'http://api.whatsmate.net/v2/whatsapp/group/message/' + instance_id;
	
	var headers = {
		'Content-Type': 'application/json',
		'X-WM-CLIENT-ID': client_id,
		'X-WM-CLIENT-SECRET': client_secret
	};
	
	var message = req.body.messages[0];
	var wa_message_summary = message.incident.summary.replace(/\\n/g, '\n');

	var wa_message = '*Incident Title:* ' + wa_message_summary + '\n*Event:* ' + message_type_strings[message.event] + '\n*By:* ' + message.incident.last_status_change_by.summary + '\n*Service:* '  + message.incident.service.name + '\n*URL:* ' + message.incident.html_url;
	
	var body = {
		'group_admin': group_admin,
		'group_name': group_name,
		'message': wa_message
	};
	
	var options = {
		headers: headers,
		uri: url,
		method: 'POST',
		json: body
	};
	
	request(options, function(error, response, body) {
		if ( ! response.statusCode || response.statusCode < 200 || response.statusCode > 299 ) {
			console.log("Error sending WA message: " + error + "\nResponse: " + JSON.stringify(response, null, 2) + "\nBody: " + JSON.stringify(body, null, 2));
		} else {
			console.log("Sent WA message: " + JSON.stringify(response, null, 2));
		}
	});
	
	res.end();
});


app.post('/pingdom', function(req, res) {

	var action = req.query.action;
	var incident = req.body.messages[0].incident;
	var token = req.query.token;
	var user = req.query.user;
	var pingdom_user = req.query.pingdom_user;
	var pingdom_pass = req.query.pingdom_pass;
	var pingdom_token = req.query.pingdom_token;
	var event = req.body.messages[0].event;

	getTriggerLE(token, incident.first_trigger_log_entry.self, function(logEntry) {
		console.log("event type: " + event );
		var pingdom_args, note;
		if ( action == "pause" || event == 'incident.acknowledge' ) {
			console.log("pause the check");
			pingdom_args = "paused=true";
			agent = req.body.messages[0].log_entries[0].agent.summary ? req.body.messages[0].log_entries[0].agent.summary : "unknown";
			note = "Paused pingdom check " + logEntry.log_entry.channel.incident_key + " because the incident was acknowledged by " + agent + ". Will unpause when the incident is resolved.";
		} else if ( action == "unpause" || event == 'incident.resolve' ) {
			console.log("unpause the check");
			pingdom_args = "paused=false";
			agent = req.body.messages[0].log_entries[0].agent.summary ? req.body.messages[0].log_entries[0].agent.summary : "unknown";
			note = "Unpaused pingdom check " + logEntry.log_entry.channel.incident_key + " because the incident was resolved by " + agent + ".";
		} else {
			res.end();
			return;
		}

		var options = {
			auth: {
				user: pingdom_user,
				pass: pingdom_pass
			},
			headers: { 
				"App-Key": pingdom_token
			},
			uri: "https://api.pingdom.com/api/2.0/checks/" + logEntry.log_entry.channel.incident_key + "?" + pingdom_args,
			method: "PUT"
		};
		
		request(options, function(error, response, body) {
			if ( ! response.statusCode || response.statusCode < 200 || response.statusCode > 299 ) {
				console.log("Error requesting from pingdom: " + error + "\nResponse: " + JSON.stringify(response, null, 2) + "\nBody: " + JSON.stringify(body, null, 2));
			} else {
				if ( user ) {
					addNote(token, incident.self, user, note);
				}
			}
		});	
	});

	res.end();
});



app.listen(app.get('port'), function() {
	console.log('PDbutton listening on port', app.get('port'));
});
