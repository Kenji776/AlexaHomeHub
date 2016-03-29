# AlexaHomeHub
NodeJs server for Alexa IFTTT interactions

What the hell is this?: Alexa is a speech recognition and automation platform from Amazon. The echo device uses Alexa to allow people to have a device in their home they can talk to to perform actions, such as playing music, update shopping lists, get news, weather, sports, etc. Alexa also supports create 'custom' actions through the If This Then That service. Basically letting you create rules that say 'When alexa hears this phrase, perform this action'. By combining the Alexa Channel, and the Maker channel which allows you to send web requests to a server with data I've created a home web server which can allow Alexa to perform actions it could not nativly. My software contains several samples such as logging in an interacting with alarm.com security systems, printing files on a local printer, and ordering pizza from Sarpinos. Basically it's a web server for accepting POST requests to perform automatic actions.

To run first you'll need to create a key.txt file which contains a private encryption key, because I've decided that the server will only deal with encrypted requests to ensure that sensative information is never exposed on IFTTT, since it's a public service. This key will be used to encrypt and 
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

Then once you have your encryped request, you can head over to IFTTT and create a new recipie. You'll use the Alexa channel to trigger when a phrase is said. Just create any phrase you like. Then make the action be a 'Maker' channel web request. Make sure to set it as a post request, and point it at where your server lives. For the data paste in your encrypted JSON payload. Then once you save it you should be good to go.

Oh, one side note. If you are trying to make the automatic pizza ordering work, you'll need your favorite order ID. Log into the sarpinos website. Create an order, and save it as a favorite. Log out, log back in. When it asks if you you want to order a saved favorite, right click on the button for your order and inspect element. In that button will be an orderId attribtue. That's what you'll need to pass into the function as the orderId attribute.

For more info about this project, check my blog: https://iwritecrappycode.wordpress.com/2016/03/23/making-alexa-order-me-a-pizza/
