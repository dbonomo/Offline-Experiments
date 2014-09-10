/* clock.js */
function updateIndicator() {
//Grab the indicator field, append the content with Online if navigator.offLine
//returns true, and Offline if it returns false. Only works with network connectivity, 
//not internet, server, page, etc...
 document.getElementById('indicator').textContent = navigator.onLine ? 'Online' : 'Offline';
}
//Sets an interval defined below
setInterval(function () {
    //gets the clock element and appends the computer set date 
    document.getElementById('clock').value = new Date();
    //Currently sets the interval to 1000ms (1sec)
}, 1000);

// Get the text field that we're going to track
var field = document.getElementById("field");
// See if we have an autosave value
// (this will only happen if the page is accidentally refreshed)
if (sessionStorage.getItem("autosave")) {
	// Restore the contents of the text field
	field.value = sessionStorage.getItem("autosave");
}
// Listen for changes in the text field
field.addEventListener("change", function() {
	// And save the results into the session storage object
	sessionStorage.setItem("autosave", field.value);
});