/* Alexa Home Hub Alpha
Author: Daniel Llewellyn - Kenji776@gmail.com
Date: 3/26/2016
Description: A node.js script that creates a web server which can respond to incoming post requests to perform actions. The intended use is to create actions you'd
             like to perform from Alexa. Then create rules using IFTTT to send POST requests to this script when a specific phrase is said. In reality any system that
			 can send post requests with JSON payloads can use this script. 
*/

//includes, allows access to features needed by this script.
var webdriver = require('selenium-webdriver');
var http = require('http');
var fs = require('fs');
var https = require('https');
var request = require("request")
var crypto = require('crypto');

//global variables
var PORT = 80; //port server should listen on. Should match whatever your router has it's internal port forward port set as.
var encryptionKeyFile = 'key.txt'; //text file that contains your own encryption key. Your key can be anything. Should be in same dir as this script.
var algorithm = 'aes-256-ctr'; //encryption method. Don't change unless you know what you are doing.
var globalPassword; //is read from file specified in encryptionKeyFile
var driver; //holds reference to selenium web driver.
var globalResponse; 

//namespace/object for storing all invokable methods.
var actions = new Object(); //global container.
actions.alarm = new Object(); //contains functions related to alarm.com such as locking, unlocking, and arming the security system.
actions.sarpinos = new Object(); //contains functions related to sarpinos pizza. Such as ordering a saved favorite.
actions.home = new Object(); //contains functions related to other devices in the home. Such as chromecast and printers.
actions.utils = new Object(); //contains miscellaneous functions that may be required. Such as creating encrypted requests. 

//nampespace/object for private functions not meant to be directly invoked from external calls
utils = new Object();
utils.alarm = new Object();

//runs on startup
function init()
{
	console.log('Server spun up\r\n');
	
	readKeyFromFile(function(key){
		console.log('Encryption key read from file and set');
		globalPassword = key;
	});
}

//Helper functions and classes

/* Encrypts a string using the given key (or global key if one is not provided) using the global encryption algorithm */		
function encrypt(text,key)
{
	var thisPassword = key == null ? globalPassword : key;
	var cipher = crypto.createCipher(algorithm,thisPassword)
	var crypted = cipher.update(text,'utf8','hex')
	crypted += cipher.final('hex');
	return crypted;
}

/* Decrypts a string using the given key (or global key if one is not provided) using the global encryption algorithm */ 
function decrypt(text,key){
	
	var thisPassword = key == null ? globalPassword : key;
	var decipher = crypto.createDecipher(algorithm,thisPassword)
	var dec = decipher.update(text,'hex','utf8')
	dec += decipher.final('utf8');
	return dec;
}

/* Reads the global encryption key from the file specified. This key is used for all following encryption/decryption calls */
function readKeyFromFile(callback)
{
	try
	{
		fs.readFile(encryptionKeyFile, function (err, data) {
		  if (err) throw err;
			if(typeof callback == 'function')
			{
				callback(data);
			}	
		});

	}
	catch(exception)
	{
		console.log('Unable to read encryption key from file: ' + encryptionKeyFile); 
	}
}

/* send response data back to requester */
function sendResponse(response,responseObject)
{
	try
	{
		response.writeHeader(200, {"Content-Type": "text/plain"});
		response.write(JSON.stringify(responseObject));
		response.end();
		console.log('Request Complete\r\n');
	}
	catch(exception)
	{
		console.log('That there error happened. Shit bro.\r\n')
		console.log(exception);
	}
}

/* fetches JSON from a remote URL.  */
function getRemoteJsonData(url,callback)
{
	request({
		url: url,
		json: true
	}, function (error, response, body) {
	
		if (!error && response.statusCode === 200) {
			console.log(body) // Print the json response
			if(typeof callback == 'function')
			{
				callback(body);
			}				
			
		}
		else{
			console.log('Error occured getting remote data');
			console.log(error);
		}
	})
}
/* Encrypts the data property of an object using the key property. Returns the encrypted data property for use in other function calls. */
actions.utils.encrypt = function(dataObject,callback)
{
	var key = dataObject.hasOwnProperty('key') && dataObject['key'].length > 0 ? dataObject.key : globalPassword;	
	callback(encrypt(dataObject.data,key));
}

/* basic response object that is returned to the caller. Every invokeable function returns on of these */
function resObj(actionName)
{
	this.success = true;
	this.message = 'pending';
	this.action = actionName;
}

/* creats a selenium web driver instance for browser automation */
function buildDriver()
{
	driver = new webdriver.Builder().withCapabilities(webdriver.Capabilities.chrome()).build();
	driver.manage().timeouts().implicitlyWait(10 * 1000);
}

server = http.createServer( function(request, response) {

    console.log('Request received from ' + request.connection.remoteAddress + '\r\n');
	//listen for POST requests
    if (request.method == 'POST') {

		console.log("POST Request Received\r\n");

		//when we get the data from the post reqest
        request.on('data', function (data)
		{
			try
			{
				//parse content in the body of the request. It should be JSON
				try
				{
					var parsedContent = JSON.parse(data);
				}
				catch(exception)
				{
					console.log('Invalid JSON. Check Syntax! Make sure to escape contained quotes with backslash');
				}
				if(!parsedContent.hasOwnProperty('action'))
				{
					console.log('No action parameter specified. Aborting\r\n');
				}
				if(!parsedContent.hasOwnProperty('data'))
				{
					console.log('No data parameter specified. Aborting\r\n');
				}
									
				requestData = parsedContent;
				
				if(parsedContent.hasOwnProperty('encrypted') && parsedContent.encrypted == true && parsedContent.hasOwnProperty('data'))
				{
					requestData = JSON.parse(decrypt(parsedContent.data));				
				}

				//the name of the action will come as [service.action] (without brackets) so we need to deduce if there is an action within the given service object by the name
				var actionParts = parsedContent.action.split('.');
				
				console.log('Looking for function: ' + actionParts[0] +'.'+actionParts[1] + '\r\n');
				
				try
				{
					if(typeof actions[actionParts[0]][actionParts[1]] == 'function')
					{
						actions[ actionParts[0] ][ actionParts[1] ](requestData, function(responseObject){
							console.log('Function response complete. Sending Response to client.');
							sendResponse(response,responseObject);
						});
					}
					else
					{
						throw 'Invalid method name';
					}
				}
				catch(exception)
				{
					console.log('Invalid Request');
					console.log(exception);
					var responseObject = new resObj('Invalid Request');					
					responseObject.success = false;
					responseObject.message = exception.message;
					
					sendResponse(response,responseObject);
				}
			}
			catch(exception)
			{	
				console.log('ERROR! ' + exception);
				var resultObject = new resObj('Error');					
				resultObject.success = false;
				resultObject.message = 'error: ' + exception.message;
				sendResponse(response,resultObject);
			}			
		});
    }
	else
	{
		console.log('Non post request. Ignoring.');
		var resultObject = new resObj('Error');					
		resultObject.success = false;
		resultObject.message = 'Invalid request type';
		sendResponse(response,resultObject);
	}


}).listen(PORT, function(){
    //Callback triggered when server is successfully listening. Hurray!
    console.log("Server listening on: http://localhost:%s", PORT);
});

//Alarm.com methods
actions.alarm.login = function(username,password,callback)
{
	try
	{
		//request the login page with the locks page as the return url
		driver.get('https://www.alarm.com/login');
		driver.findElement(webdriver.By.name('ctl00$ContentPlaceHolder1$loginform$txtUserName')).sendKeys(username);
		driver.findElement(webdriver.By.name('txtPassword')).sendKeys(password);
		driver.findElement(webdriver.By.name('ctl00$ContentPlaceHolder1$loginform$signInButton')).click().then(function(){
			callback(true);
		});

	}
	catch(exception)
	{
		callback(false);
	}
}

//calls the arm stay function on the alarm.com website.
//TODO: Abstract this to make it able to either disarm, arm stay, or arm away instead of needing different methods for each.
actions.alarm.armSystemStay = function(dataObject,callback)
{
	var resultObject = new resObj('alarm.armSystemStay');
	resultObject.message = 'System Armed!';	
	buildDriver();
	
	var loginCall = actions.alarm.login(dataObject.username,dataObject.password,function(loginResult){
		try
		{	
			if(loginResult)
			{
				//wait for the main arm stay button to show up and then click it. If it does not exist, then just abort processing.
				driver.findElement(webdriver.By.name('ctl00$phBody$ArmingStateWidget$btnArmStay')).then(function(webElement){
					webElement.click();
				},function(error){
					console.log('Error handliner for arm stay button called');
					resultObject.success = false;
					resultObject.message = error.name;
				});
				
				//wait for button to show up. This should always show up if the previous one did.		
				driver.findElement(webdriver.By.name('ctl00$phBody$ArmingStateWidget$btnArmOptionStay')).then(function(webElement){
					webElement.click();
				},function(error){
					console.log('Error handliner for arm stay confirm button called');
					resultObject.success = false;
					resultObject.message = error.name;
				});
			}
			else
			{
				resultObject.success = false;
				resultObject.message = 'Login Failed';		
			
			}
		}
		catch(exception)
		{
			console.log('catch function hit');
			resultObject.success = false;
			resultObject.message = exception.message;	
		}

		driver.quit().then(function(){
			console.log('Driver quit statment hit');		
			if(typeof callback == 'function')
			{
				callback(resultObject);
			}		
		});	
	});
}

/* Either locks or unlocks the front door */
actions.alarm.toggleFrontDoor = function(dataObject,callback)
{	
	var toggleVerb = dataObject.lock ? 'Locked' : 'Unlocked';
	var resultObject = new resObj('alarm.toggleFrontDoor');
	resultObject.message = toggleVerb;
	
	buildDriver();
	
	var loginCall = actions.alarm.login(dataObject.username,dataObject.password,function(loginResult){	
		console.log('Login Call Result is: ' + loginResult);
		
		try
		{		
			console.log('Login result For Toggle Front Door is: ' + loginResult);
			
			if(loginResult)
			{
				driver.get('https://www.alarm.com/web/automation/locks.aspx');

				console.log('Locking? :' +dataObject.lock + '\r\n');
				
				var elementToClick = dataObject.lock ? 'ctl00$phBody$summaryRepeater$ctl00$lockButton' : 'ctl00$phBody$summaryRepeater$ctl00$unlockButton';
				
				//wait for the main arm stay button to show up and then click it. If it does not exist, then just abort processing.
				driver.findElement(webdriver.By.name(elementToClick)).then(function(webElement){
					webElement.click();
				},function(error){
					console.log('Unable to toggle door status. Likely door already in requested status');
					resultObject.success = false;
					resultObject.message = error.name;
				});				
			}
			else
			{
				console.log('Login Failed. Sad Times \r\n');
				resultObject.success = false;
				resultObject.message = 'Login Failed';		
			}
		}
		catch(exception)
		{
			resultObject.success = false;
			resultObject.message = exception.message;	
		}

		driver.quit().then(function(){	
			if(typeof callback == 'function')
			{
				callback(resultObject);
			}		
		});
	});
}
/* Attempts to play a file with the given name/path on the default chromecast device */
actions.home.play = function(dataObject,callback)
{
	var resultObject = new resObj('home.play');
	
	console.log('Attempting to play ' + dataObject.target);
	
	var exec = require('child_process').exec;
	var cmd = 'castnow ' + dataObject.target;

	exec(cmd, function(error, stdout, stderr) {
		//cant really return the stdout here since this command continues to generate output after being called.
		resultObject.message = 'Playing...';
		callback(resultObject);		
	});	
}

/* Attempts to stop whatever is being cast on the default chromecast device by passing null */
actions.home.stop = function(dataObject,callback)
{
	var resultObject = new resObj('home.stop');
	
	console.log('Attempting to stop chromecast');
	
	var exec = require('child_process').exec;
	var cmd = 'castnow  ""';

	exec(cmd, function(error, stdout, stderr) {
		//cant really return the stdout here since this command continues to generate output after being called.
		resultObject.message = 'Stopping...';
		callback(resultObject);		
	});	
}

/* Prints a given URL on the default printer */
actions.home.printUrl = function(dataObject,callback)
{
	var resultObject = new resObj('home.printUrl');
	
	console.log('Called Print Url with Url of ' + dataObject.printUrl);
	
	var exec = require('child_process').exec;
	var cmd = 'printhtml url="'+dataObject.url+'"';

	exec(cmd, function(error, stdout, stderr) {
		resultObject.message = stdout;
		callback(resultObject);		
	});		
}

/* Prints an image file on the local machine with the given name. File should be in same folder as this script */
actions.home.printImageFile = function(dataObject,callback)
{
	var resultObject = new resObj('home.printFile');
	
	console.log('Called Print file with name of ' + dataObject.file);
	
	var exec = require('child_process').exec;
	var cmd = 'mspaint /pt ' + dataObject.file;

	exec(cmd, function(error, stdout, stderr) {
		resultObject.message = stdout;
		callback(resultObject);		
	});		
}

/* Orders a pizza from Sarpinos using the online interface. 

Sample Data:

	Unencrypted Request (this would be sent to utils.encrypt to generate the encrypted request which can actually be used):
	{
		"action": "utils.encrypt",
		"data": "{ \"username\": \"xxxx@xxxx.com\" \"password\": \"xxxxxxx\", \"orderId\": \"xxxxxx\", \"ccNumber\": \"xxxxxxxxxxxx\", \"ccExpMonth\": \"00\", \"ccExpYear\": \"2000\", \"ccv\": \"000\", \"tip\": \"5.00\", \"ccZip: \"55432\" }",
		"encrypted": false
	} 

	Encrypted Request:
	{
		"action": "sarpinos.orderPizza",
		"data": "f613f8f479bad299bdfedf446aedd52f0f50a8e333e1b834823ba5ed071719dc602f45b4bb274f705903b8299f95ef8c4ce9b7fb5ac461a1f33f30aed169c9b57884a2ce32ef4ec7571c5334099eda58f5e3fffc101883443efd1dc228e61acd364796710dae6bc13503c1641778e5da2e02b025efa29672b341b21fb312ddbcbecb831688c5f82986ab583c484bea67bd025a3a5274c950dec31f3fed6d80583fdd8e2e0207ab4c9b465ad370bca0cfe14e29fa3689ea939b28cda4e24183612596abf93c1e941236c52ba650",
		"encryped": true
	}
*/
actions.sarpinos.orderPizza = function(dataObject,callback)
{
	var resultObject = new resObj('sarpinos.orderPizza');
	
	buildDriver();
	
	//request the login page
	driver.get('https://order.gosarpinos.com/Login');
	
	driver.findElement(webdriver.By.name('Email')).sendKeys(dataObject.username);
	driver.findElement(webdriver.By.name('Password')).sendKeys(dataObject.password);
 
	driver.findElement(webdriver.By.css("input[type='submit']")).then(function(webElement){
		webElement.click();
	},function(error){
		console.log('Unable to login.');
		resultObject.success = false;
		resultObject.message = JSON.stringify(error);
	});	

	console.log('Logged in as: ' + dataObject.username);

	//wait for order page to load
	driver.wait(function() {
		return driver.getTitle();
	},5000);
	
	console.log('Attempting To Choose Favorite Order With Id: ' + dataObject.orderId);
		
	//have to wait until the proper order button appears since it's in a dialog. If it isn't found after 5 seconds, fail. Otherwise click the corresponding order button
	//the favorite order button has an attribute 'type' of 'button' and a 'data-favorite-id' attribute with the id of that order
	//equivilent jQuery tested to work $('button[data-favorite-id="428388"]').click();

	driver.wait(function () {
		return driver.findElement(webdriver.By.css("button[data-favorite-id='"+dataObject.orderId+"']")).isDisplayed();
	}, 5000);
	
	driver.findElement(webdriver.By.css("button[data-favorite-id='"+dataObject.orderId+"']")).then(function(webElement){
		webElement.click();
	},function(error){
		console.log('Unable to find favorite order id button with id: ' + +dataObject.orderId);
		resultObject.success = false;
		resultObject.message = JSON.stringify(error);
	});	
	
	//after the button above is clicked, that dialog closes and another one opens. This one asks the user to select delivery or pickup. We want delivery
	//the delivery button has an attribute with a 'data-type' of 'WBD' and an attribute 'role' of 'button'
	
	driver.wait(function () {
		return driver.findElement(webdriver.By.css("button[data-type='WBD'][role='button']")).isDisplayed();
	}, 5000);
			
	driver.findElement(webdriver.By.css("button[data-type='WBD'][role='button']")).then(function(webElement){
		webElement.click();
	},function(error){
		console.log('Unable to find delivery button.');
		resultObject.success = false;
		resultObject.message = JSON.stringify(error);
	});
	
	//ensure the checkout button is visible
	driver.sleep(2000);
	
	driver.findElement(webdriver.By.css("button[id='wiLayoutColumnGuestcheckCheckoutBottom'][role='button']")).then(function(webElement){
		webElement.click();
	},function(error){
		console.log('Unable to find checkout button');
		resultObject.success = false;
		resultObject.message = JSON.stringify(error);
	});
	
	//then the browser will move to the order screen. Once it loads we have to populate the order field data

	//wait for payment page to load
	driver.wait(function() {
		return driver.getTitle();
	},5000);	

	//wait until the pay by credit card button shows up.
	driver.wait(function () {
		return driver.findElement(webdriver.By.id("wiCheckoutPaymentCreditCard")).isDisplayed();
	}, 5000);

	//check the pay by credit card radio button
	driver.findElement(webdriver.By.id("wiCheckoutPaymentCreditCard")).click(); 
	
	//wait until the credit card number box shows up
	driver.wait(function () {
		return driver.findElement(webdriver.By.id("Payment_CCNumber")).isDisplayed();
	}, 5000);
	
	//populate the form fields
	driver.findElement(webdriver.By.name('Payment_CCNumber')).sendKeys(dataObject.ccNumber);

	//stupid jQuery ui selects are impossible to set with normal selenium since the original select is hidden. So use an execute script to set em.
	driver.executeScript("$('#Payment_ExpMonth').val("+dataObject.ccExpMonth+");");
	driver.executeScript("$('#Payment_ExpYear').val("+dataObject.ccExpYear+");");
	
	//set credit card verification code and zip
	driver.findElement(webdriver.By.name('Payment_CVV')).sendKeys(dataObject.ccv);
	driver.findElement(webdriver.By.name('Payment_AVSZip')).sendKeys(dataObject.ccZip);
	
	//this is another kind of odd field. I think its a jQuery ui spinner, so using sendKeys doesn't operate as you think.
	//it's easier to use a jQuery script to set the value directly. Making sure to parse the value as a float.
	driver.executeScript("$('#Payment_CCTip').val("+parseFloat(dataObject.tip)+");");

	driver.findElement(webdriver.By.id('wiCheckoutButtonNext')).then(function(webElement){
		webElement.click();
	},function(error){
		console.log('Error submitting order. Unable to click checkout button.');
		resultObject.success = false;
		resultObject.message = JSON.stringify(error);
	});
	
	//wait for confirmation page to load.
	driver.wait(function() {
		return driver.getTitle();
	},5000);

	//close the driver instance then return the data to the caller.
	driver.quit().then(function(){	
		console.log('Ordering complete!');
		resultObject.success = true;
		resultObject.message = 'Order Placed Successfully';
		
		if(typeof callback == 'function')
		{
			callback(resultObject);
		}		
	});
}
init();


