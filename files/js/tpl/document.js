/**
 * This module contains functionality related directly to the document.tmpl template
 */
define(['jquery', 'hideelem', 'multiselect', 'tagbuilder', 'popupbox'],
        function ($, hideElem, multiselect, tagbuilder, popupbox) {
   'use strict';

    var lib = {};

    lib.misc = function (conf) {
        var msComponent,
            tagBuilderComponent,
            concFormResetButtonActions,
            widgetMap,
            queryTypesHints;


        hideElem.targetedLinks();
        if (conf.focus) {
            hideElem.focusEx(hideElem.focus);
        }

        if ($('#tag-builder-widget').length > 0) {
            msComponent = multiselect.createMultiselectComponent('tag-builder-widget',
                { width : '500px', useNamedCheckboxes : false, allowMultipleOpenedBoxes : false });
            tagBuilderComponent = tagbuilder.attachTagLoader(conf.corpname, conf.numTagPos, msComponent, {
                resetButton : null,
                backButton : null,
                hiddenElm : $('#tag'),
                tagDisplay : $('#tag-display')
            });
            concFormResetButtonActions = {
                tagrow : tagBuilderComponent.resetButtonClick
            };
            widgetMap = {
                tagrow : tagBuilderComponent
            };
            queryTypesHints = {
                iqueryrow : conf['queryTypesHints_iqueryrow']
            };
            hideElem.cmdSwitchQuery(widgetMap, concFormResetButtonActions, queryTypesHints);
        }
        hideElem.loadHideElementStoreSimple();
        hideElem.loadHideElementStore('${files_path}');

        $('#queryselector').bind('change', function () {
            hideElem.cmdSwitchQuery(widgetMap, concFormResetButtonActions, queryTypesHints);
        });


    };


    lib.bindClicks = function () {
        var msg2;

        msg2 = function (updatedElement) {
            $.ajax({
                url : 'ajax_get_corp_details?corpname=$corpname',
                success : function (data) {
                    $(updatedElement).empty().append(data);
                },
                error : function () {
                    $(updatedElement).empty().append(conf.messages['failed_to_load_corpus_info']);
                }
            });
        };

        $('#positions-help-link').bind('click', function (event) {
            popupbox.createPopupBox(event, 'positions-help', $('#toolbar-info'), conf.messages['msg1']);
            event.stopPropagation();
        });

        $('#corpus-desc-link').bind('click', function (event) {
            popupbox.createPopupBox(event, 'corpus-details-box', $('#corpus-desc-link'), msg2, {
                'height' : 'auto',
                'width' : 'auto'
            });
            event.stopPropagation();
        });

        $('input[class="select-all"]').bind('click', function (event) {
                hideElem.selectAllCheckBoxes(event.target, $(event.target).attr('data-item-name'));
        });

        $('a#top-level-help-link').bind('click', function (event) {
            hideElem.cmdHelp('https://trac.sketchengine.co.uk/');
            event.stopPropagation();
            return false;
        });

        $('#submenu li.menu_switch a').bind('click', function (event) {
            hideElem.cmdSwitchMenu($(event.target).attr('data-path'));
        });

        $('#error button').bind('click', function (event) {
            win.history.back(1);
        });

        $('img.plus-minus').each(function () {
            $(this).bind('click', function (event) {
                hideElem.cmdHideElementStore($(this).attr('data-elementid'), $(this).attr('data-storeval'), $(this).attr('data-path'));
            });
        });
    }

    lib.init = function (conf) {
        lib.misc(conf);
        lib.bindClicks();
    };

    return lib;

});