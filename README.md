# AlexaHomeHub
NodeJs server for Alexa IFTTT interactions

Home web server for accepting POST requests to perform automatic actions. Originally developed to accept requests from the
Alexa platform via If This Then That, however it will work with anything that can send POST requests with JSON payloads.

To run first you'll need to create a key.txt file which contains a private encryption key. This key will be used to encrypt and 
decrypt the data payloads so you'll be safe sending sensative information to the server from IFTTT. Then you'll need to setup port
forwarding in your router to send incoming requests to the computer the server is running on, on the port you can configured.

After that you'll need to create the encrypted POST requests that will be sent to the server. Each request contains a JSON object that
has 3 properties, action, data, and encrypted. Like this

{
	"action": "utils.encrypt",
	"data": "{ \"username\": \"xxxx@xxxx.com\",
	           \"password\": \"xxxxxxx\", 
	           \"orderId\": \"xxxxxx\", 
	           \"ccNumber\": \"xxxxxxxxxxxx\", 
	           \"ccExpMonth\": \"00\",
	           \"ccExpYear\": \"2000\", 
	           \"ccv\": \"000\", 
	           \"tip\": \"5.00\", 
	           \"ccZip: \"55432\" }",
	"encrypted": false
} 

That request would then return an encrypted string that contains your data object encrypted with your key. That encrypted string can then
by fed to the proper function. Like so

{
	"action": "sarpinos.orderPizza",
	"data": "f613f8f479bad299bdfedf446aedd52f0f50 [Data omitted]",
	"encryped": true
}

When the server receivs that request it will see the action matches a function name. It will decrypt the data in the data attribute and parse it
to a JSON object. That data will then be handed to the function which will then do whatever it needs. I realize this process is a bit cumbersom and I will
be implimenting an interface to make it easier in the near future. For now this more of a developer resource than a finished product. 
