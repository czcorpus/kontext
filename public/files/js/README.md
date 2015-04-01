KonText's custom JavaScript libraries API
=========================================

popupbox.js
-----------

This library allows you to display a (non-modal) box with specified content on a page. This can be done either by
binding the *popupbox* to a clickable HTML element or manually. The content can be some static HTML/text or a function
which generates a content by itself.


### .open(contents, position, options)

Creates a box manually (i.e. it starts to open once the function is called).

#### contents

Specifies a content to be added to the box. This argument can have two forms:

  * a string representing HTML or a text to be shown
  * a function *contents(TooltipBox, finalizeCallback)* which builds a content by itself (e.g. by loading some server
    data using AJAX)

In latter case you have an instance of TooltipBox available which gives you an access to the box's DOM plus some additional
helper functions. To be able to display the content properly, *finalizeCallback* must be called once everything is ready
to be shown. This allows you to use also asynchronous (e.g. AJAX-based) solutions.

#### position

An object of the form *{left: [size in px], top: [size in px], height: [size in px] }* specifying box's position and
height in pixels.


#### options

Additional configuration of the box:

  * *width* - width in pixels; also 'nice' value can be used which produces a size based on golden ratio
  * *height* - height in pixels
  * *fontSize* - this sets box's CSS font-size property; **deprecated**
  * *timeout* - number of milliseconds after which box closes automatically; if empty then the box is shown until user
    closes it
  * *type* (info, warning, error, plain) - first three values cause the box to show a respective icon indicating type
    of content (e.g. warning = red exclamation mark, info = blue letter "i" etc.)
  * *beforeOpen* - a custom function is called before the box is opened; the function can return a value which is
    available to following callbacks; this can be used e.g. to start some AJAX-loading animation and pass it to other
    callback to be able to close it once the loading process is finished
  * *onShow* - a custom function is called after the content is ready and visible; if your *beforeOpen* function returned a value then it is passed as an argument here
    the function can return a value (see *onClose*)
  * *onClose* - a custom function is called once the box is closed; if your *onShow* function returned a value then it is passed as an argument here
  * *onError* - a custom function is called in case an error occurs; two arguments are passed - beforeOpen and onShow return values
  * *domId* - a custom DOM ID can be specified for the created box
  * *htmlClass* - a custom HTML class can be specified for the created box
  * *calculatePosition* - if *true* then *popupbox* calculates a proper position for the box; this applies only as soon
    as the box is bound to some clickable element


### .bind(elm, contents, options)

Binds a *popupbox* to a clickable element.

#### elm

An element the *popupbox* will be bound to (typically a link or a button)

#### contents

The same as in *.open(contents, position, options)* function


#### options

The same as in *.open(contents, position, options)* function


### .abbr(context)

Turns all the *abbr* elements within a specified subtree into a texts with a clickable question mark and bound
*popupbox*.

#### context

An HTML element or jQuery or a string specifying where to search and replace *abbr* elements. If nothing is provided
then the whole document is used.


treecomponent.js TODO
----------------

This object parses specified <SELECT> elements with additional path information stored in OPTIONs' *data-path*
attributes and generates an expandable and clickable nested tree.

### .createTreeComponent(selResult, messages, options, customCallback)

#### selResult

An HTMLElement or jQuery or a string specifying *SELECT* elements the *treecomponent* will be applied to

#### messages

An object containing translations. If nothing is provided then English messages are used.

#### options

An object specifying additional configuration

  * *clickableText* (true|false)
  * *title*
  * *searchable* (true|false)

#### customCallback

An optional function which is called once user clicks a leaf node of the tree. The function has a signature
*customCallback(event, currPathItem)* where *event* is jQuery event object and *currPathItem* is a string specifying
item's path (e.g. /corpora/spoken/experimental)

multiselect.js
--------------

**[TBD]**


tagbuilder.js
-------------

**[TBD]**

