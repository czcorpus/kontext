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
    var qs = $('queryselector'),
        newid = qs.options[qs.selectedIndex].value,
        FocusElem = $(newid.substring(0, newid.length - 3)),
        oldval = FocusElem.value,
        i,
        elementId,
        oldelem,
        elem;

    for (i = 0; i < qs.options.length; i += 1) {
        elementId = qs.options[i].value;
        elem = $(elementId);

        if (elementId == newid) {
            elem.className = elem.className.replace("hidden", "visible");
            //if (elem.)

        } else {
            oldelem = $(elementId.substring(0, elementId.length - 3));
            if (elem.className.search('visible') > -1 & !oldval) {
                oldval = oldelem.value;
            }
            oldelem.value = '';
            elem.className = elem.className.replace("visible", "hidden");
        }
    }
    // Keep the value of the last query
    FocusElem.value = oldval;
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

function selectAllCheckBoxes(initiator, name) {
    var i,
        form,
        ancestors = initiator.ancestors(),
        chkStatus,
        tmp;

    for (i = 0; i < ancestors.length; i += 1) {
        if (ancestors[i].nodeName === 'FORM') {
            form = ancestors[i];
            break;
        }
    }
    if (initiator.readAttribute('data-action-type') == '1') {
        chkStatus = true;
        initiator.writeAttribute('data-action-type', 2);
        tmp = initiator.readAttribute('value');
        initiator.writeAttribute('value', initiator.readAttribute('data-alt-value'));
        initiator.writeAttribute('data-alt-value', tmp);

    } else if (initiator.readAttribute('data-action-type') == '2') {
        chkStatus = false;
        initiator.writeAttribute('data-action-type', 1);
        tmp = initiator.readAttribute('value');
        initiator.writeAttribute('value', initiator.readAttribute('data-alt-value'));
        initiator.writeAttribute('data-alt-value', tmp);
    }
    if (form !== undefined) {
        form.select('input[type="checkbox"][name="' + name + '"]').each(function (item) {
            item.checked = chkStatus;
        });
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
        if (elem.select) {
        	elem.select();
        }
	}
}
