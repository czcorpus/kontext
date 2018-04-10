import * as cookies from 'vendor/cookies';
declare var $:any;

export function init():void {
    var lang = cookies.getItem('language');
    if (typeof lang == 'undefined' || lang=="") {
        lang="en";
    }
    // let's hope there's always a logo and use that to get the theme path
    var logo = $("#logo-image").attr("src");
    var theme_path = logo.substring(0, logo.length - "/kontext-logo.svg".length);
    $("ul#localization-bar").append('<li>'
        + '<a href="#" class="flag flag-en" id="en">' +
        '<img src="' + theme_path + '/lindat-common/public/img/flags/en.png" title="English"/></a>'
        + '&nbsp;&nbsp;<a href="#" class="flag flag-cs" id="cs">' +
        '<img src="' + theme_path + '/lindat-common/public/img/flags/cs.png" title="Czech"/></a>'
        + '</li>');
    $(".flag-" + lang).addClass("selected");
    //
    $(".flag").click(function() {
        var lang = $(this).attr("id");
        cookies.setItem("language", lang);
        location.reload();
        });
}


