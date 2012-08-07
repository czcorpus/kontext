// various custom functions (not only hiding elements)

function getCookieValue(cookiename) {
	var allcookies = document.cookie;
	var pos = allcookies.indexOf(cookiename + "=");
	if (pos != -1) {
		var start = pos + cookiename.length + 1;
		var end = allcookies.indexOf(";", start);
		if (end == -1) end = allcookies.length;
		return allcookies.substring(start, end);
	} else {
		return ".";
	}
}

function cmdHideElementStore(elementid, storeval, path) {
	var elem = window.document.getElementById(elementid);
	var img = window.document.getElementById(elementid+"img");
	var cookieval = getCookieValue("showhidden");
	cookieval = cookieval.replace(new RegExp("\\." + elementid + "\\.", "g"), ".");
	if (elem.className.match("hidden")) {
		elem.className = elem.className.replace("hidden", "visible");
		img.src = path + "/img/minus.png";
		cookieval += elementid + ".";
	} else {
		elem.className = elem.className.replace("visible", "hidden");
		img.src = path + "/img/plus.png";
	}
	if (storeval) {
		var date = new Date();
		date.setTime(date.getTime() + (30*24*60*60*1000));
		document.cookie = "showhidden=" + cookieval 
				+ "; expires=" + date.toGMTString();
	}
}

function loadHideElementStore(path){
    var cookie = new Object();
    var ids = getCookieValue("showhidden").split('.')
    for (var i = 0; i<ids.length; i++){
        cookie[ids[i]] = 1;
        }
    var all_elements = document.getElementsByTagName("img");
    for (var i=0; i < all_elements.length; i++){
        var onclick = all_elements[i].onclick;
        if ((typeof onclick == 'function') &&
            (onclick.toString().match('cmdHideElementStore\\('))){
            id = onclick.toString().replace('"', "'").replace('"', "'").split("'")[1];
            elem = document.getElementById(id);
            img = document.getElementById(id + "img");
            if (!elem){
                continue;
            }
            if (cookie[id] == 1){
                elem.className = elem.className.replace("hidden", "visible");
                img.src = path + "/img/minus.png";
            } else {
                elem.className = elem.className.replace("visible", "hidden");
                img.src = path + "/img/plus.png";
            }
        }
    } 
}

function cmdHideElementStoreSimple(elementid, storeval) {
	var elem = window.document.getElementById(elementid);
	var cookieval = getCookieValue("showhidsim");
	cookieval = cookieval.replace(new RegExp("\\." + elementid + "\\.", "g"), ".");
	if (elem.className.match("hidden")) {
		elem.className = elem.className.replace("hidden", "visible");
		cookieval += elementid + ".";
	} else {
		elem.className = elem.className.replace("visible", "hidden");
	}
	if (storeval) {
		var date = new Date();
		date.setTime(date.getTime() + (30*24*60*60*1000));
		document.cookie = "showhidsim=" + cookieval
				+ "; expires=" + date.toGMTString();
	}
}

function loadHideElementStoreSimple(){
    var cookie = new Object();
    var ids = getCookieValue("showhidsim").split('.')
    for (var i = 0; i<ids.length; i++){
        cookie[ids[i]] = 1;
        }
    var all_elements = document.getElementsByTagName("a");
    for (var i=0; i < all_elements.length; i++){
        var onclick = all_elements[i].onclick;
        if ((typeof onclick == 'function') &&
            (onclick.toString().match('cmdHideElementStoreSimple'))){
            id = onclick.toString().replace('"', "'").replace('"', "'").split("'")[1];
            elem = document.getElementById(id);
            if (!elem){
                continue;
            }
            if (cookie[id] == 1){
                elem.className = elem.className.replace("hidden", "visible");
            } else {
                elem.className = elem.className.replace("visible", "hidden");
            }
        }
    }
}


function cmdGetFocusedId() {
        var oldid = getCookieValue("query_type");
        var id = oldid.substring(0, oldid.length-3);
        if(window.document.getElementById(id)) {
	        return(oldid.substring(0, oldid.length-3));
	} else {
		return('iquery');
        }
}


function cmdSwitchQuery() {
    var qs = window.document.getElementById('queryselector');
    var newid = qs.options[qs.selectedIndex].value;
    var FocusElem = window.document.getElementById(newid.substring(0,
                                                   newid.length-3));
    var oldval = FocusElem.value;

    for (var i=0; i<qs.options.length; i++) {
        elementId = qs.options[i].value;
        elem = window.document.getElementById(elementId);

        if (elementId == newid){
            elem.className = elem.className.replace("hidden", "visible");
        } else {
            var oldelem = window.document.getElementById(elementId.substring(0,
                                                    elementId.length-3));
            if (elem.className.search('visible')> -1 & !oldval){
                oldval = oldelem.value;
            }
            oldelem.value = '';
            elem.className = elem.className.replace("visible", "hidden");
        }
    }
    // Keep the value of the last query
    FocusElem.value = oldval;
    FocusElem.focus();
    FocusElem.select();

	var date = new Date();
	date.setTime(date.getTime() + (30*24*60*60*1000));
	document.cookie = "query_type=" + newid
			+ "; expires=" + date.toGMTString();
}

function clearForm(f) {
   if (document.getElementById('error') != null) {
      document.getElementById('error').style.display='none';
   }
   f.reset();
   for (var i = 0; i < f.elements.length; i++) {
      var e = f.elements[i];
      if (e.type == "text") {
         e.value = "";
      }
      if (e.name == "default_attr") {
         e.value = "";
      }
      if ((e.name == "lpos") || (e.name == "wpos")) {
         e.value = "";
      }
   }
}

function cmdSwitchMenu(path) {
    var styleSheets = document.styleSheets;
    var horizontal_style = null;
    for (var i=0; i<styleSheets.length; i++) {
        if (styleSheets[i].href.search('horizontal.css')>-1){
            horizontal_style = styleSheets[i];
        };
    }
    if (horizontal_style == null){
        position = 'top';
        var v_css  = document.createElement('link');
        v_css.rel = 'stylesheet'
        v_css.type = 'text/css';
        v_css.href = path+'/css/horizontal.css';
        document.getElementsByTagName('head')[0].appendChild(v_css);
    } else {
        if (horizontal_style.disabled) {
            position = 'top';
            horizontal_style.disabled = false;
        } else {
            position = 'left';
            horizontal_style.disabled = true;
        }
    }

        var date = new Date();
        date.setTime(date.getTime() + (30*24*60*60*1000));
        document.cookie = "menupositi=" + position
                        + "; expires=" + date.toGMTString();
}


function redirect_to_save(form, save_function) {
  form.action = save_function;
  form.submit();
}


function deselect_all_chboxes(formname, name) {
  var form = document.getElementById(formname);
  for (var i = 0; i < form.elements.length; i++) {
    var e = form.elements[i];
	 if ((e.name == name) && (e.type == 'checkbox')) {
      e.checked = false;
    }
  }
}


function select_all_chboxes(formname, name) {
  var form = document.getElementById(formname);
  for (var i = 0; i < form.elements.length; i++) {
    var e = form.elements[i];
	 if ((e.name == name) && (e.type == 'checkbox')) {
      e.checked = true;
    }
  }
}

function cmdHelp(generic) {
    var lookfor = document.getElementById('searchhelp').value
    if (lookfor) {
        window.open('http://www.google.com/#q=site%3Atrac.sketchengine.co.uk+'+
                                                    lookfor.replace(/ /g,'+'));
    }
    else{
        window.open(generic);
    }
}


function targetedLinks() {  
 if (!document.getElementsByTagName) return;  
 var anchors = document.getElementsByTagName("a");  
 for (var i=0; i<anchors.length; i++) {  
   var anchor = anchors[i];
   if (anchor.getAttribute("href") &&  
       anchor.getAttribute("rel") != null)
     anchor.target = anchor.getAttribute("rel");
 }  
}

function focusEx(focus) {
	var elem = $(focus);
    if (elem) {
        elem.focus();
        if (elem.select) {
        	elem.select();
        }
	}
}
