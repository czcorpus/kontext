/*
 * Copyright (c) UFAL
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; version 2
 * dated June, 1991.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

define(['jquery','bootstrap'], function ($) {
    'use strict';

    var lib = {};
    var in_searching = false;

    var expand_all_corpora = function() {
        $(".corpora-set-header.toggle-below").each(function(){
           if ( !($(this).find(".to-toggle").is(':visible')) ) {
               $(this).click();
           }
        });
    };

    lib.init = function () {

        $(".toggle-below").each( function(){
           $(this).click(function() {
               $(this).find(".to-toggle").each(function() {
                   $(this).toggle();
               });
               if (0 < $(this).find(".toggle-plus.glyphicon-plus-sign").length) {
                   $(this).find(".toggle-plus.glyphicon-plus-sign").removeClass("glyphicon-plus-sign");
                   $(this).find(".toggle-plus").addClass("glyphicon-minus-sign");
               } else {
                   $(this).find(".toggle-plus.glyphicon-minus-sign").removeClass("glyphicon-minus-sign");
                   $(this).find(".toggle-plus").addClass("glyphicon-plus-sign");
               }
           });
        });

        $(".corplist-search").click(function() {
            // show all corpora
            expand_all_corpora();
            var search_in = $(this).attr("data-search");
            var search_for = $.trim($(this).text());
            // fade corpora not having the specific attribute
            $(".corpus").each(function(){
                var values = $(this).attr("data-" + search_in);
                if ( -1 !== values.indexOf(search_for) ) {
                    if ( 0 == $(this).find(".search-selected").length ) {
                        // create a button, ouch, and make it reset filters
                        $(this).find('[data-search=\"' + search_in + '"]').last().after(
                            '<span class="glyphicon glyphicon-zoom-out search-selected clickable" ' +
                            ' style="font-size:14px"> </span>'
                        );
                        $(this).find(".search-selected").click(function() {
                            $(".corpus").each(function(){
                                $(this).fadeTo( "fast", 1.0 );
                                $(this).find(".search-selected").remove();
                            });
                        });
                    }
                }else {
                    $(this).fadeTo( "fast", 0.1 );
                }
            });
            // make sure we get to the element after expanding
            $('html, body').animate({
                scrollTop: Math.max( $(this).offset().top - 50, 50 )
            }, 250);
        });

        $(".corplist-tabs").click(function(){
            if ( $("#corpus-list-default").is(':visible') ) {
                $("#corpus-list-default").hide();
                $("#for-corpus-list-default").show();
                $("#corpus-list-sizes").show();
                $("#for-corpus-list-sizes").hide();
            }else {
                $("#corpus-list-sizes").hide();
                $("#for-corpus-list-sizes").show();
                $("#corpus-list-default").show();
                $("#for-corpus-list-default").hide();
            }
        });

        $(".corplist-reset-search").click(function(){
            $(".corpus").each(function(){$(this).find("corplist-reset-search").remove();});
        });

        $(".corpus-main-info").each(function(){
           $(this).hover(function(){
                $(this).parent().parent().addClass("corpus-hover");
           }, function(){
                $(this).parent().parent().removeClass("corpus-hover");
           });
        });

    };

    return lib;
});
