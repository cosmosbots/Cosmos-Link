const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const WebSocketServer = require('websocket').server;
const http = require('http');

var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});

server.listen(80, function() {
    console.log((new Date()) + ' Server is listening on port 80');
});

wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false
});

async function cosmosAccountsServerTokenVerify(token) {
  // Generate a state: long random integer
  const state = Math.floor(Math.random() * 999999999).toString()

  // Verify the provided token
  const res = await fetch("https://account.cosmos-softwares.com/token/verify/" + token + "/" + state);
  const data = await res.text();
  
  // Check if the token is valid
  if (data === "TokenValid+" + state) 
    return true;
  else 
    return false;
}

function originIsAllowed(origin) {
  // put logic here to detect whether the specified origin is allowed.
  return true;
}

var connClients = {};
var serverMap = {};

wsServer.on('request', function(request) {
    if (!originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject();
      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
      return;
    }

    var connection = request.accept();
    console.log((new Date()) + ' Connection accepted.');

    function sendMsg(json) {
      try { connection.sendUTF(JSON.stringify(json)); } catch (ex) { console.error(ex.stack); }
    }

    var clientID = null;
    var accToken = null;
    var clientType = null;

    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            console.log('Received Message: ' + message.utf8Data);
            var json = null;
            try {
              json = JSON.parse(message.utf8Data);
            } catch {
              sendMsg({"error": true, "code": "JSONParseError"});
              return;
            }
            try {
              if (json.body == "ClientGenID") {
                if (clientID == null) {
                  var nid = Math.floor(Math.random() * 9999999999).toString();
                  connClients[nid] = {};
                  clientID = nid;
                  clientType = "client";
                  sendMsg({"error": false, "id": nid});
                }
              } else if (json.body == "ServerGenID") {
                if (clientID == null) {
                  var nid = Math.floor(Math.random() * 9999999999).toString();
                  connClients[nid] = {};
                  clientID = nid;
                  clientType = "server";
                  sendMsg({"error": false, "id": nid});
                }
              } else if (json.body == "ServerRenewID" && json.headers.id == clientID && clientType == "server") {
                var nid = Math.floor(Math.random() * 9999999999).toString();
                var odat = JSON.stringify(connClients[json.headers.id]);
                connClients[nid] = JSON.parse(odat);
                clientID = nid;
                delete connClients[json.headers.id];
                sendMsg({"error": false, "id": nid});
              } else if (json.body == "ClientRenewID" && json.headers.id == clientID && clientType == "client") {
                var nid = Math.floor(Math.random() * 9999999999).toString();
                var odat = JSON.stringify(connClients[json.headers.id]);
                connClients[nid] = JSON.parse(odat);
                clientID = nid;
                delete connClients[json.headers.id];
                sendMsg({"error": false, "id": nid});
              } else if (json.body == "TryLinkACC" && json.headers.authorization && clientID != null) {
                cosmosAccountsServerTokenVerify(json.headers.authorization)
                .then(valid => {
                  if (valid) {
                    if (accToken == null) {
                      accToken = json.headers.authorization;
                      connClients[clientID] = {"cosmosAccountToken": json.headers.authorization};
                      if (clientType == "server") {
                        if (json.data.nickname != "" || json.data.nickname != null) {
                          var serverData = {
                            "clientID": clientID,
                            "type": "server",
                            "internalLinkData": {
                              "accountID": json.headers.authorization
                            },
                            "nick": json.data.nickname
                          };
                          if (JSON.stringify(serverMap[json.headers.authorization]) == undefined) {
                            serverMap[json.headers.authorization] = {}
                          }
                          serverMap[json.headers.authorization][clientID] = {};
                          serverMap[json.headers.authorization][clientID] = serverData;
                          serverMap[json.headers.authorization][clientID]['connection'] = connection;
                        } else {
                          sendMsg({"error": true, "code": "InvalidServernickname"})
                        }
                      } else if (clientType == "client") {
                        var clientData = {
                          "clientID": clientID,
                          "type": "client",
                          "internalLinkData": {
                            "accountID": json.headers.authorization
                          }
                        }
                        connClients[clientID] = {};
                        connClients[clientID] = clientData;
                      }
                      sendMsg({"error": false, "code": "CosmosAccountLinked"});
                    } else {
                      sendMsg({"error": true, "code": "AccountAlreadyLinked"});
                    }
                  } else {
                    sendMsg({"error": true, "code": "InvalidAccountToken"});
                  }
                });
                sendMsg({"error": false, "code": "AwaitVerification"})
              } else if (json.body == "GetAccountServerDirectory" && clientID != null && accToken != null && clientType == "client") {
                sendMsg({"error": false, "code": "RetrievedServerList", "list": serverMap[accToken]});  
              } else if (json.body == "RequestServerConnection" && clientID != null && accToken != null && clientType == "client" && json.headers.serverID && json.headers.authorization) {
                try {
                  if (connClients[json.headers.serverID]) {
                    console.log(`Client ${clientID} is requesting a server connection to server ${json.headers.serverID}`);
                    var accVerify = false;
                    if (connClients[clientID].internalLinkData.accountID == serverMap[connClients[clientID].internalLinkData.accountID][json.headers.serverID].internalLinkData.accountID) {
                      accVerify = true;
                    }
                    var now = new Date;
                    var utcTimestamp = Date.UTC(now.getUTCFullYear(),now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), now.getUTCMilliseconds());
                    var serverMessage = JSON.stringify(
                      {
                        "error": false,
                        "code": "ClientConnectAttempt",
                        "data": {
                          "remote": {
                            "clientID": clientID,
                            "verified": accVerify,
                            "requestServerID": json.headers.serverID
                          }
                        },
                        "timestamp": utcTimestamp,
                        "tmz": "UTC"
                      }
                    )
                    serverMap[connClients[clientID].internalLinkData.accountID][json.headers.serverID].connection.sendUTF(JSON.stringify(serverMessage));
                  } else {
                    sendMsg({"error": true, "code": "ServerNotFound"});
                  }
                } catch (e) {
                  console.error(e.stack)
                  sendMsg({"error": true, "code": "ServerNotFound"});
                }
              } else {
                sendMsg({"error": true, "code": "InvalidRequest"});
              }
            } catch {
              sendMsg({"error": true, "code": "ServerError"});
              return;
            }
        }
    });
    connection.on('close', function(reasonCode, description) {
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });
});
