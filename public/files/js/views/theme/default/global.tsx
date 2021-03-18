/*
 * Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

import { createGlobalStyle } from 'styled-components';
import * as v from './index';

export const GlobalStyle = createGlobalStyle`

    body {
        font-family: ${v.defaultFontFamily};
        color: ${v.colorDefaultText};
        background-image: ${v.mainBackground};
        font-size: 10pt;
        margin: 0;
        padding: 0;
        height: 100%;
    }

    #viewport {
        position: absolute;
        display: flex;
        flex-direction: column;
        flex-wrap: nowrap;
        top: 0;
        width: 100%;
        min-height: 100%;
    }

    section #topbar-help-mount {
        display: flex;
        align-items: center;
        margin: 0;
        padding: 0;
    }

    section > .bar {
        display: flex;
        align-content: center;
        margin: 0;
        padding: 0.4em 0.6em;
        background-color: ${v.colorLightFrame};
        border-radius: 6px 6px 0 0;
    }

    section > .bar > h2 {
        margin: 0;
        padding: 0;
        font-size: 140%;
        font-weight: 300;
        color: ${v.colorDarkGreenText};
        flex-grow: 1;
    }

    section > .bar .topbar-help-icon {
        display: flex;
        align-content: center;
    }

    section > .bar .topbar-help-icon img {
        display: block;
        width: 0.9em;
    }

    button,
    input[type="button"],
    input[type="submit"] {
        padding: 0.2em 0.4em;
    }

    fieldset {
        border: none;
    }

    h1 {
        font-size: 170%;
        margin-top: 0;
    }

    h2 {
        font-size: 140%;
        margin: 0.5em auto 0.5em 0.5em;
        font-weight: 500;
    }

    img {
        border: none;
    }

    input[type="text"],
    input[type="password"] {
        border: ${v.inputBorderStyle};
        border-radius: ${v.inputBorderRadius};
        display: inline-block;
        vertical-align: middle;
        padding-left: 0.2em;
    }

    input[readonly][type="text"] {
        background-color: ${v.colorLightGreen};
    }

    input[type="number"] {
        border: ${v.inputBorderStyle};
        border-radius: ${v.inputBorderRadius};
        width: 35px;
        padding: 3px;
    }

    pre {
        background-color: #fff;
        border: 1px #000 dotted;
        margin: 0;
        padding: .5em;
    }

    hr {
        color: ${v.colorFrameFieldset};
        background-color: ${v.colorFrameFieldset};
        height: 1px;
        border: none;
    }

    a {
        color: ${v.colorLinkDark};
        cursor: pointer;
        text-decoration: underline;
    }

    a.external {
        padding-right: 1em;
        background-image: url(../img/external-link.png);
        background-repeat: no-repeat;
        background-position: 100% 0;
    }

    #content {
        display: block;
        margin: 0;
        overflow: auto;
        padding: 0 2em 2em ${v.ucnkTopbarLeftMargin};
        flex-grow: 2;
    }

    #content > section {
        border-radius: ${v.borderRadiusDefault};
        display: inline-block;
        vertical-align: top;
        margin: 1em 0 0 0;
        background-color: ${v.colorSectionBg};
        box-shadow: ${v.portalBoxShadow};
        min-width: 70%;
    }

    #content > section.query,
    #content > section.pquery {
        min-width: auto;
    }

    #content > section > *:not(.bar) {
        margin: 1em;
    }

    section.inner > * {
        margin: 0;
    }

    section.inner {
        /*
        margin: 0 0 0.4em 0;
        padding: 1em 3em 1em 2em;
        box-shadow: 0 3px 3px -2px #A0A0A0;
        */
        margin-bottom: 1em;
        padding: 0;
    }

    section.inner h3 {
        margin: 0;
        text-align: left;
        padding-bottom: 0.5;
    }

    #content > section.full {
        width: 95%;
    }

    #content > section.exclusive {
        display: block;
        padding-bottom: 20px;
    }

    section.corpus-and-query {
        display: block;
        margin: 1.3em 0 0 0;
        color: #595857;
        border: none;
        background-color: transparent;
    }

    section.corpus-and-query #query-overview-mount {
        margin-top: 1.5em;
        margin-bottom: 0;
    }

    section.corpus-and-query #view-options-mount {
        margin: 0;
    }

    section.corpus-and-query #general-overview-mount {
        margin: 0;
    }

    section.corpus-and-query #recent-queries-mount {
        margin: 0;
    }

    section.corpus-and-query ul#query-overview-bar {
        padding: 0;
        margin: 0;
        list-style-type: none;
        font-family: ${v.condensedFontFamily};
    }

    section.corpus-and-query ul#query-overview-bar > li {
        display: inline-block;
        margin: 0;
    }

    section.corpus-and-query ul#query-overview-bar > li a.args {
        text-decoration: none;
        color: ${v.colorLogoBlue};
    }

    section.corpus-and-query ul#query-overview-bar > li a.args:hover {
        text-decoration: underline;
    }

    section.corpus-and-query ul#query-overview-bar > li .transition {
        font-size: 120%;
        color: ${v.colorLightText};
    }

    fieldset.query-exec-opts {

        margin-bottom: 0.7em;
    }

    fieldset.query-exec-opts legend {
        margin-left: 0.7em;
        margin-right: 0.7em;
    }

    fieldset.query-exec-opts ul {
        list-style-type: none;
        margin: 0;
    }

    fieldset.query-exec-opts ul li {
        margin: 0;
        padding: 0.2em 0;
    }

    fieldset.query-exec-opts ul li label {
        color: ${v.colorDefaultText};
        white-space: nowrap;
    }

    fieldset.query-exec-opts ul li label input[type="radio"] {
        margin: 0 0.3em 0.1em 0;
        padding: 0;
        vertical-align: middle;
    }

    fieldset.query-exec-opts ul li label.active {
        color: ${v.colorDefaultText};
    }

    /* system pop-up messages */

    .messages {
        display: block;
        position: fixed;
        left: 50%;
        top: 7em;
        z-index: 10000;
    }

    .messages .message {
        background-color: #FEFEFE;
        border: solid 1px #eeeeee;
        border-radius: ${v.borderRadiusDefault};
        box-shadow: 2px 2px 3px #aaa;
        color: ${v.colorDefaultText};
        font-weight: 700;
        margin: 5pt;
        padding: 0.4em 0.4em 0.4em 1em;
        position: relative;
        left: -50%;
    }

    .messages .message.info {
        color: ${v.colorDefaultText};
    }

    .messages .icon-box {
        position: absolute;
        padding: 0;
        top: 50%;
        margin-top: -0.8em;
    }

    .messages .icon-box .icon {
        display: block;
        width: 1.6em;
        height: 1.6em;
        margin: 0;
        padding: 0;
    }

    .messages .message-text {
        margin-top: 1em;
        margin-bottom: 1em;
        margin-left: 3em;
        margin-right: 3em;
    }

    .messages .button-box {
        position: absolute;
        top: 50%;
        right: 1em;
        margin-top: -0.5em;
    }

    .messages .button-box .close-icon {
        display: block;
    }

    .messages .button-box .close-icon img {
        width: ${v.closeButtonSize};
        height: ${v.closeButtonSize};
    }

    /* an optional organization toolbar (contents injected via a plug-in) */

    #common-bar {
        height: 40px;
        overflow: hidden;
        background-color: rgba(82, 80, 78, 0.199);
        color: #000000;
        width: 100%;
    }

    #common-bar .UserPane {
        color: ${v.colorDefaultText};
        background-color: transparent;
    }

    #common-bar .UserPane a {
        color: rgb(44, 25, 25);
    }

    #common-bar .UserPane .user {
        float: right;
        padding-right: 10pt;
        padding-top: 7pt;
    }

    #common-bar .UserPane .user img.avatar {
        width: 1.5em;
        vertical-align: middle;
        margin-right: 0.3em;
    }

    #common-bar .UserPane .user img.avatar a.username {
        text-decoration: none;
    }

    #common-bar .UserPane .user img.avatar a.username:hover {
        text-decoration: underline;
    }


    header#topbar {
        padding: 0;
        color: #000000;
    }

    header#topbar > * {
        vertical-align: top;
    }

    header#topbar #menu-bar {
        white-space: nowrap;
    }

    header#topbar .navig-wrapper {
        display: inline-block;
        padding: 2em 1em 0 ${v.ucnkTopbarLeftMargin};
    }

    header#topbar a#logo-wrapper {
        display: inline;
        background-color: transparent;
    }

    header#topbar a#logo-wrapper img {
        display: inline-block;
        vertical-align: middle;
    }

    #main-menu-mount {
        box-sizing: border-box;
        margin: 0 0 0 1em;
        padding: 0 0.7em;
        display: inline-block;
        list-style-type: none;
        height: 100%;
        vertical-align: middle;
        background-color: transparent;
        border: 2px solid transparent;
        border-radius: ${v.borderRadiusDefault};
    }

    #menu-bar {
        margin: 0;
        display: inline-block;
        white-space: nowrap;
        background-color: transparent;
        font-size: 1.2em;
        width: auto;
        height: 3em;
    }

    #menu-bar a:hover {
        text-decoration: none;
    }

    #menu-bar ul img {
        vertical-align: middle;
    }

    #menu-bar a.trigger:hover {
        cursor: default;
    }

    #active-corpus a {
        color: ${v.colorLogoBlue};
        text-decoration: none;
    }

    #active-corpus a:hover {
        text-decoration: underline;
    }

    #active-corpus .subcorpus {
        color: ${v.colorLogoBlue};
    }

    #active-corpus .subcorpus.foreign {
        color: ${v.colorLogoPink};
    }

    .ktx-pagination {
        border-style: solid;
        border-width: 0.1em;
        border-color: ${v.colorLightFrame};
        border-radius: ${v.inputBorderRadius};
    }

    section > .ktx-pagination,
    section #result-mount .ktx-pagination {
        margin: 0;
    }

    section > .ktx-pagination form,
    section #result-mount .ktx-pagination form {
        margin: 0 20px;
        padding-bottom: 5px;
        padding-top: 5px;
    }

    .ktx-pagination-core,
    .desc {
        display: inline-block;
    }

    .ktx-pagination-core {
        vertical-align: middle;
    }

    .ktx-pagination-core .curr-page {
        display: inline-block;
        padding: 0;
        text-align: left;
        width: 3em;
    }

    .ktx-pagination-core .curr-page input {
        display: block;
        width: 3em;
        border: ${v.inputBorderStyle};
        border-radius: ${v.inputBorderRadius};
        box-sizing: border-box;
    }

    .ktx-pagination-core .curr-page .overlay {
        position: absolute;
    }

    .ktx-pagination-core .curr-page img.ajax-loader-bar {
        margin-top: 0.2em;
        margin-left: 0.2em;
        display: block;
    }

    .ktx-pagination-left {
        display: inline-block;
        padding-right: 0.3em;
    }

    .ktx-pagination-left > a {
        display: inline-block;
        vertical-align: middle;
        margin-top: -0.1em;
    }

    .ktx-pagination-left > a > img {
        display: block;
        height: ${v.navigIconSize};
    }

    .ktx-pagination-right {
        display: inline-block;
        padding-left: 0.3em;
    }

    .ktx-pagination-right > a {
        display: inline-block;
        vertical-align: middle;
        margin-top: -0.1em;
    }

    .ktx-pagination-right > a > img {
        display: block;
        height: ${v.navigIconSize};
    }

    .ktx-pagination a:last-of-type img {
        padding-left: 0.3em;
    }

    .hidden {
        display: none;
    }

    .highlighted {
        color: ${v.colorLogoPink};
        font-weight: 700;
    }

    .note {
        color: ${v.colorLightText};
        font-weight: normal;
    }

    .text-type-top-bar {
        padding: 5px 10px;
        text-align: right;
    }

    a.disabled,
    input.disabled,
    button.disabled {
        color: ${v.colorLightText};
    }

    a:hover {
        color: ${v.colorLogoPink};
        text-decoration: underline;
    }

    div.buttons {
        padding-top: 1.2em;
    }

    div.buttons button:not(:last-child),
    div.buttons span.util-button:not(:last-child) {
        margin-right: 0.7em;
    }

    form .select-all {
        display: inline-block;
        padding-top: 10px;
        color: ${v.colorLogoBlue};
    }

    fieldset.inactive {
        border-color: #DEDEDE;
    }

    /* ------- general data table ------- */

    table.data {
        background-color: #FFFFFF;
        border-collapse: separate;
        border-spacing: 0;
        border: 1px solid ${v.colorLightFrame};
        border-radius: ${v.borderRadiusDefault};
    }

    table.data > tbody > tr > td,
    table.data > tbody > tr > th,
    table.data > thead > tr > th {
        text-align: left;
        padding: 0.3em 0.7em 0.3em 0.8em;
        border-color: ${v.colorDefaultGreen};
        border-width: 0 1pt 0 0;
        border-style: solid;
    }

    table.data > tbody > tr > td th:last-child,
    table.data > tbody > tr > td:last-child {
        border: none;
    }

    table.data > tbody > tr > th,
    table.data > thead > tr > th {
        color: ${v.colorDefaultText};
        background-color: ${v.colorDefaultGreen};
        font-weight: bold;
        padding-top: 1em;
        padding-bottom: 0.5em;
    }

    table.data td.empty-result-cell {
        text-align: center;
        padding: 0.7em 1em;
    }

    table.data td.num {
        text-align: right;
    }

    table.data td.center {
        text-align: center;
    }

    table.data th a {
        color: ${v.colorDefaultText};
    }

    table.data td a {
        color: ${v.colorLinkDark};
        text-decoration: none;
    }

    table.data td a:hover {
        text-decoration: underline;
    }

    table.data th.super {
        text-align: center;
    }

    table.data > tbody > tr:nth-child(odd) {
        background-color: ${v.colorTableEvenBg};
    }

    table.data .deleted {
        color: ${v.colorLogoPink};
    }

    table.data .sort-flag {
        margin-left: 0.4em;
        margin-right: 0.4em;
    }

    table.form {
        margin-top: 10px;
        border-collapse: collapse;
    }

    table.form th {
        font-weight: 400;
        text-align: left;
        white-space: nowrap;
    }

    table.form th,
    table.form td {
        padding: 0.3em 0.7em 0.3em 0;
    }

    .num {
        text-align: right;
    }

    #content form.login {
        height: auto;
        overflow: auto;
        color: ${v.colorDefaultText};
    }

    .struct em {
        text-decoration: none;
        color: #575757;
        font-size: 130%;
    }

    table.results-range-and-paging {
        border-collapse: collapse;
    }

    table.results-range-and-paging th {
        font-weight: normal;
        text-align: left;
    }

    table.results-range-and-paging td {
        padding: 3pt 0;
    }

    a.context-help {
        text-decoration: none;
        padding: 0 0 0 0.2em;
    }

    a.context-help img {
        display: inline-block;
        vertical-align: top;
        width: 0.6em;
        padding-bottom: 0.1em;
    }

    a.util-button,
    button.util-button {
        display: inline-block;
        border: 1px solid ${v.colorLogoBlue};
        border-radius: ${v.inputBorderRadius};
        background-color: ${v.colorButtonDefault};
        text-decoration: none;
        padding: 3px 8px;
        color: ${v.colorLogoBlue};
        box-shadow: 0px 1px 2px rgba(150, 150, 150, 0.9), inset 0px 0px 2px rgba(215, 215, 215, 0.2);
        cursor: default;
    }

    a.util-button.active,
    button.util-button.active {
        background-color: ${v.colorLightPink};
        color: rgb(39, 35, 36);
    }

    a.util-button.active:hover,
    button.util-button.active:hover {
        background-color: #FFF0E8;
        color: rgb(39, 35, 36);
    }

    .util-button.cancel.disabled,
    .util-button.disabled {
        display: inline-block;
        border: 1px solid ${v.colorSuperlightText};
        border-radius: ${v.inputBorderRadius};
        background-color: #ffffff;
        text-decoration: none;
        padding: 3px 8px;
        color: ${v.colorSuperlightText};
        box-shadow: 0px 1px 2px rgba(150, 150, 150, 0.9), inset 0px 0px 2px rgba(215, 215, 215, 0.2);
        cursor: default;
    }

    a.util-button.cancel,
    button.util-button.cancel {
        color: ${v.colorLogoPink};
    }

    a.util-button:hover,
    button.util-button:hover {
        background-color: ${v.colorButtonHover};
    }

    #error-reporting {
        font-size: 7.5pt;
    }

    .monospace {
        font-family: ${v.monospaceFontFamily};
    }

    .default-button, .danger-button {
        font-size: 1em;
        color: ${v.colorWhiteText};
        text-decoration: none;
        padding: 0.3em 0.7em;
        background-color: ${v.colorLogoBlue};
        border-radius: 0.2em;
        border: 1px solid ${v.colorLogoBlue};
        box-shadow: 0px 1px 2px rgba(000, 000, 000, 0.5), inset 0px 0px 2px rgba(255, 255, 255, 0.2);
    }

    .danger-button {
        background-color: ${v.colorLogoPink};
        border: 1px solid ${v.colorLogoPink};
    }

    .default-button:hover {
        background-color: ${v.colorLogoBlueShining};
        border-color: ${v.colorLogoBlueShining};
        color: ${v.colorWhiteText};
        text-decoration: none;
    }

    .panic {
        font-size: 180%;
    }

    .error-input {
        border: 2px solid ${v.colorLogoPink} !important;
        border-radius: ${v.borderRadiusDefault} !important;
    }

    .highlighted-label {
        color: ${v.colorLogoPink} !important;
    }

    .inline-label {
        padding-left: 0.5em;
    }


    #modal-overlay .block-help {
        color: ${v.colorDarkGreenText};
    }

    #modal-overlay .block-help .contents h2 {
        margin-left: 0;
        margin-top: 1em;
        font-size: 1.5em;
    }

    #modal-overlay .block-help .contents h3 {
        margin-left: 0;
        font-size: 1.2em;
        color: ${v.colorLogoPink};
        font-weight: normal;
    }

    p.boxed-par {
        text-align: justify;
    }

    .view-options .buttons img.ajax-loader {
        display: inline-block;
        margin: 0 2em;
    }

    .OptionsContainer.busy {
        text-align: center;
    }

    .OptionsContainer.busy .ajax-loader {
        display: inline-block;
        margin-bottom: 1em;
    }

    .DelItemIcon {
        display: inline-block;
        text-decoration: none;
        padding: 0 0.1em;
    }

    .DelItemIcon.disabled,
    .DelItemIcon.disabled:hover {
        cursor: default !important;
        color: ${v.colorSuperlightText} !important;
        background-color: transparent !important;
    }

    .DelItemIcon:hover {
        text-decoration: none !important;
        color: #FFFFFF !important;
    }

    .query-overview {
        padding: 1.5em;
        background-color: #E9F7FC;
        text-align: center;
    }

    .query-overview h3 {
        display: inline-block;
        margin-top: 0;
        margin-bottom: 0.5em;
        border-style: solid;
        border-color: ${v.colorDefaultGreen};
        border-width: 0 0 1px 0;
    }

    .query-overview table {
        border-collapse: collapse;
        border: none;
    }

    .query-overview table th,
    .query-overview table td {
        padding: 5px 1em;
    }

    .query-overview table th {
        color: ${v.colorLogoPink};
        border: none;
    }

    .query-overview table td {
        text-align: left;
        border: 1px solid ${v.colorDefaultGreen};
    }

    .disabled .toggle-img a {
        filter: grayscale();
        filter: opacity(25%);
    }

    .disabled .toggle-img a:hover {
        cursor: default;
    }

    @keyframes fadein {

        /* transition: opacity .3s ease-in; */
        from {
            opacity: 0;
        }

        to {
            opacity: 1;
        }
    }

    @keyframes fadeout {
        from {
            opacity: 1;
        }

        to {
            opacity: 0;
        }
    }

    @keyframes color-change {
        0% { opacity: 0; }
        100% { opacity: 1; }
    }

    ul.tabs {
        list-style-type: none;
        margin: 0 auto 1.1em auto;
        padding: 0;
        white-space: nowrap;
    }

    ul.tabs li {
        display: inline-block;
        margin: 0;
        padding: 0;
    }

    ul.tabs li:not(:first-child) {
        margin-left: 1em;
    }

    ul.tabs li:not(:last-child) {
        padding-right: 1em;
    }

    .ExpandButton {
        margin: 0.2em;
        display: inline-block;
        background-color: ${v.colorButtonDefault};
        color: ${v.colorLogoBlue};
        border-color: ${v.colorLogoBlue};
        border-width: 0.1em;
        border-style: solid;
        border-radius: ${v.inputBorderRadius};
        cursor: pointer;
    }

    .ExpandButton span {
        font-size: 1.5em;
        font-weight: bold;
        display: block;
        margin: 0 auto;
        width: 0.7em;
        line-height: 0.7em;
        height: 0.8em;
    }

    .ExpandButton:hover {
        background-color: ${v.colorButtonHover};
    }

    .ExpandButton.readonly {
        cursor: inherit;

        border-color: ${v.colorLightGrey};
        color: ${v.colorLightGrey};
    }

    .ExpandableArea .controls .ExpandButton {
        margin-right: 0.7em;
    }

    .ExpandableArea .controls > a {
        color: ${v.colorLogoBlue};
        text-decoration: none;
    }

    .ExpandableArea .controls > a:hover {
        text-decoration: underline;
    }

    .ExpandableArea.readonly .controls span {
        color: ${v.colorLightText};
    }

    #wordlist-result-mount {
        margin: 0;
    }

    #coll-view-mount {
        margin: 0;
    }


    @media screen and (max-width: 1200px), screen and (orientation:portrait) {

        #conc-dashboard-mount .ConcordanceDashboard {
            display: grid;
            grid-template-columns: auto;
        }

        #conc-dashboard-mount .ConcordanceDashboard.collapsed {
            grid-template-columns: auto;
        }

        #conc-dashboard-mount .ConcordanceDashboard.collapsed .ConcExtendedInfo header {
            padding: 0.3em;
        }

        #conc-dashboard-mount .ConcordanceDashboard.collapsed .ConcExtendedInfo headera {
            margin: 0 0 0 0.3em;
        }

        .tooltip-box.refs-detail {
            bottom: 1em;
            width: 85%;
        }
    }

    @media screen and (max-width: 479px) {

        #logo-wrapper {
            display: block !important;
            text-align: left;
        }

        header#topbar .navig-wrapper {
            display: block;
            width: 100%;
            padding: 0.7em;
        }

        #main-menu-mount {
            margin-left: 0;
            display: block;
            width: 80%;
        }

        #menu-bar {
            margin: 0;
            font-size: 1.3em;
            white-space: normal;
            height: auto;
            display: block;
        }

        #menu-level-1 {
            display: block;
        }

        #menu-level-1 li {
            display: block;
            text-align: left;
        }

        #menu-level-1 li ul.submenu {
            width: 90%;
        }

        #menu-level-1 li.disabled {
            display: none;
        }

        #menu-level-1 li.separator {
            display: none;
        }

        #topbar {
            white-space: normal;
        }

        #content {
            padding: 0.5em 0 1em 0;
        }

        #content > section {
            min-width: 0;
            display: block;
            padding-bottom: 1em;
        }

        section.inner {
            margin: 0;
            padding: 1em 0 1em 0;
        }

        #menu-level-1 > li {
            display: block;
        }

        #menu-level-1 > li.active {
            border: none;
            background-color: transparent;
        }

        #menu-level-1 > li.active > a {
            color: ${v.colorLogoBlue};
        }

        #menu-level-1 > li.active ul.submenu {
            position: initial;
            margin-left: 1em;
            margin-top: -0.1em;
        }

            #menu-level-1 > li.active ul.submenu li {
            padding: 0;
        }

        .ktx-pagination a > img {
            height: 1.5em;
        }

        #modal-overlay > .tooltip-box,
        #modal-overlay .closeable-frame {
            transform: none;
            left: 0;
            top: 10%;
            width: 100%;
        }

        header#topbar #menu-bar {
            white-space: initial;
        }

        header#topbar .corpus-and-query {
            padding-top: 0.7em;
            border-width: 1px 0 0 0;
            border-style: solid;
            border-color: ${v.colorLightText};
        }

        section.closeable-frame .heading div.control img {
            width: 1.5em;
            height: 1.5em;
        }

        #conc-dashboard-mount .ktx-pagination {
            float: initial !important;
            display: block;
            width: 100% !important;
            padding-bottom: 1em;
        }

        .tooltip-box.refs-detail {
            left: 0;
            bottom: 1em;
            transform: none;
            width: calc(100% - 3.7em);
            min-width: initial;
        }

        .StructAttrsViewOptions .StructsAndAttrsForm .struct-groups {
            grid-template-columns: 1fr 1fr;
        }

        .StructAttrsViewOptions .StructsAndAttrsForm .struct-groups div.group:nth-child(2) {
            border-style: none;
        }

        ul.tabs {
            white-space: pre-wrap;
        }

        ul.tabs li {
            display: block;
        }

        ul.tabs li:not(:first-child) {
            margin-left: 0em;
        }

        ul.tabs li:not(:last-child) {
            padding-right: 0em;
        }

    }
`;