var webdriver = require('selenium-webdriver');
var alarm_username = 'DALLEWE70';
var alarm_password = 'LavaMarker1012';
var lockHour = 23;
var unlockHour = 8;
var beenLockedToday = false;
var beenUnlockedToday = false;

var date = new Date();
var current_hour = date.getHours(); 
console.log('Checking current hour for lock status checks. Current hour is ' + current_hour  + ' Will automatically lock at ' + lockHour + ' and unlock at ' + unlockHour);
	
http = require('http');
fs = require('fs');

var port = process.env.PORT || 8080;

function monitorLoop() {
	
	date = new Date();
	current_hour = date.getHours();       
	
	if(current_hour == lockHour && !beenLockedToday) 
	{
		console.log('Lock hour hit!');
		toggleDoor(alarm_username,alarm_password,true);		
		beenLockedToday = true;
	} 
	if(current_hour == unlockHour && !beenUnlockedToday) 
	{
		console.log('Un-Lock hour hit!');
		toggleDoor(alarm_username,alarm_password,false);		
		beenUnlockedToday = true;
	}
	if(current_hour == 0)
	{
		console.log('Resetting lock status variables');
		beenLockedToday = false;
		beenUnlockedToday = false;		
	}

	setTimeout(monitorLoop,60000);

}

server = http.createServer( function(request, response) {

    console.dir('Request received');

	var responseObject = new Object();
	responseObject.message = 'Waiting';
	responseObject.status = 'OK';
		
		
    if (request.method == 'POST') {

		console.log("POST");
        
        request.on('data', function (data) 
		{
			try
			{
				console.log('Raw Data: ' + data);
				var parsedContent = JSON.parse(data);
				var action = parsedContent['action'];
				var password = parsedContent['password'];
				var username = parsedContent['username'];
				
				console.log('Action: ' + action);
				console.log('Username: ' + username);
				console.log('Password: ' + password);				
				responseObject.action = action;
				
				
				if(action == 'lock')
				{
					console.log('Locking Door!');
					var lockResult = toggleDoor(username,password,true);
					
					responseObject.actionResult = lockResult;
				}
				else if(action == 'unlock')
				{
					console.log('Unlocking Door!');
					var lockResult = toggleDoor(username,password,false);
					
					responseObject.actionResult = lockResult;
				}
				else
				{
					responseObject.message = 'No method defined with name: ' + action;
				}
				
			}
			catch(exception)
			{
				console.log(exception);
			}

			response.writeHeader(200, {"Content-Type": "text/plain"});
			response.write(JSON.stringify(responseObject));
			response.end();			
		});
    }
	else
	{
		responseObject.message = 'Please use post request';
		response.writeHeader(200, {"Content-Type": "text/plain"});
		response.write(JSON.stringify(responseObject));
		response.end();		
	}
	

}).listen(port);

function toggleDoor(username,password,lock)
{
	var lockResult = new Object();
	
	try
	{

		var driver = new webdriver.Builder().
	    withCapabilities(webdriver.Capabilities.firefox()).
	    build();
   
		driver.get('https://www.alarm.com/login?m=no_session&ReturnUrl=/web/Automation/Locks.aspx');
		driver.findElement(webdriver.By.name('ctl00$ContentPlaceHolder1$loginform$txtUserName')).sendKeys(username);
		driver.findElement(webdriver.By.name('txtPassword')).sendKeys(password);
		driver.findElement(webdriver.By.name('ctl00$ContentPlaceHolder1$loginform$signInButton')).click();
		
		console.log('Logged in');
		
		driver.wait(function() {
			return driver.getTitle().then(function(title) {
				console.log('Toggling Door Status');
				if(lock)
				{
					driver.findElement(webdriver.By.name('ctl00$phBody$summaryRepeater$ctl00$lockButton')).click();
					lockResult.message = 'Lock request sent!';
				}
				else
				{
					driver.findElement(webdriver.By.name('ctl00$phBody$summaryRepeater$ctl00$unlockButton')).click();	
					lockResult.message = 'UnLock request sent!';					
				}
				lockResult.success = true;
				

					driver.quit();
	
					return lockResult;
			});
		}, 1000);
	}
	catch(exception)
	{
		lockResult.success = false;
		lockResult.message = exception.message;
		driver.quit();

		return lockResult	
	}

}
monitorLoop();

console.log('Server spun up');


  
