require( ['jquery', 'jquery.cookie','domReady!'], function ($, cookies) {
    var lang = $.cookie('language');
    if (typeof lang == 'undefined' || lang=="") {
        lang="en";
    }

    // add localization bar dynamically
    $("ul#localization-bar").append('<li>'
         + '<a href="#" class="flag flag-en" id="en">' +
            '<img src="../files/themes/lindat/public/img/flags/en.png" title="English"/></a>'
         + '&nbsp;&nbsp;<a href="#" class="flag flag-cs" id="cs">' +
            '<img src="../files/themes/lindat/public/img/flags/cs.png" title="Czech"/></a>'
     + '</li>');
    $(".flag-" + lang).addClass("selected");
    //
    $(".flag").click(function() {
        var lang = $(this).attr("id");
        $.cookie("language", lang);
        location.reload();
        });
});

