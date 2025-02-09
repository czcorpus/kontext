import { styled } from 'styled-components';
import * as theme from '../../views/theme/default/index.js';


const corplistWidgetTableSpacing = '30pt';

export const CorplistWidget = styled.div`

    a.star-switch {
        display: inline-block;
        vertical-align: middle;
        margin-left: 0.7em;

        img {
            display: inline-block;
            vertical-align: middle;
        }
    }

    div.autocomplete-wrapper {
        margin: 1em 1em 1em 0;
        padding-bottom: 0.7em;
        border: ${theme.inputBorderStyle};
        border-radius: ${theme.inputBorderRadius};
    }


    .tt-input {
        display: block;
        margin: 0 auto;
        width: 90%;
        padding: 0.3em 0.7em;
        font-size: 1.2em;
        border-style: solid;
        border-width: 0 0 1px 0;
        border-color: #d2ebf4;
        border-radius: 0;
    }

    .tt-input:focus {
        outline: none;
        border-width: 0 0 1px 0;
        border-style: solid;
        border-color: ${theme.colorLogoBlue};
    }

    #subcorp-selector {
        padding: 0.15em 0.3em;
    }

    div.starred {
        display: inline-block;
        padding-left: 10pt;
    }

    button.util-button.waiting {
        .corpus-name {
            visibility: hidden;
        }

        .loader {
            position: absolute;
        }
    }

    tr td.num {
        color: ${theme.colorLightText};
    }

    .corplist-widget {
        max-width: 500pt;
        border: 1px solid #E4E4E4;
        background-color: #FEFDFD;
        border-radius: 3px;
        box-shadow: 0 0 10pt #a5a5a5;
        padding: 1em 0.7pt 0 0.7em;
        text-align: left;

        .footer {
            text-align: center;
            color: ${theme.colorLightText};
            font-size: 80%;
            height: 2em;
            line-height: 2em;
            margin-top: 10pt;
        }

        .tmp-hint img {
            display: inline-block;
            width: 1em;
            height: 1em;
        }

        .srch-field {
            color: inherit;
        }

        .srch-field.initial {
            color: #ababab;
        }

        table td {
            padding: 0.2em 0.2em 0.2em 1em;
            vertical-align: middle;
        }

        table td.tools {
            text-align: left;

            img {
                display: block;
            }

        }

        tr td a {
            color: ${theme.colorDefaultText};
            text-decoration: none;
            display: inline-block;
        }


        tr td a:hover {
            color: ${theme.colorLogoPink};
            text-decoration: underline;
        }

        .menu {
            margin: 0 0 10pt 0;
            text-align: center;

            a {
                text-decoration: none;
            }

            a.current {
                text-decoration: underline;
                font-weight: bold;
            }
        }

        .labels {
            padding: 5pt;

            a {
                text-decoration: none;
            }

            a:hover {
                text-decoration: underline;
            }
        }

        .ajax-loader {

            height: 2em;
            text-align: center;

            img {
                display: inline-block;
                width: 1em;
                margin: 1em;
            }
        }

        .input-wrapper {
            position: relative;
            left: -24px;
        }

        .keyword {
            display: inline-block;
            text-decoration: none;
            font-size: 1em;
            background-color: ${theme.colorBgLightBlue};
            border-style: solid;
            border-color: #b0e1f3;
            border-width: 1px;
            border-radius: ${theme.borderRadiusDefault};
            margin-right: 0.4em;
            margin-bottom: 0.5em;
            white-space: nowrap;
        }

        .keyword.reset {
            background-color: ${theme.colorLightGrey};
            border-color: ${theme.colorLightText};
            color: ${theme.colorDefaultText};
        }

        .keyword .overlay {
            padding: 0.2em 0.4em;
            display: inline-block;
            -webkit-transition: all 0.2s ease-in-out;
            -moz-transition: all 0.2s ease-in-out;
            -o-transition: all 0.2s ease-in-out;
            -ms-transition: all 0.2s ease-in-out;
            transition: all 0.2s ease-in-out;
        }

        .keyword.selected {
            color: ${theme.colorBgLightBlue};
            background-color: ${theme.colorLogoBlue};
        }

        table.favorite-list,
        table.featured-list {
            display: inline-block;
            vertical-align: top;
            box-sizing: border-box;
            border-spacing: 0;

            th {
                font-weight: bold;
            }

            .DelItemIcon img {
                width: 0.8em;
                margin-top: -0.15em;
            }
        }

        table.favorite-list {

            th.conf {
                text-align: right;
                padding-right: 8pt;
                padding-left: 0;

                img.config {
                    cursor: pointer;
                }
            }

            img.remove {
                display: inline-block;
                padding: 0;
                cursor: pointer;
                width: ${theme.navigIconSize};
            }

            img.remove.disabled {
                display: none;
            }

            img.config {
                vertical-align: middle;
                width: 1em;
                margin-left: 0.7em;
            }

            img.starred {
                width: 0.85em;
            }

            tr.data-item.in-trash a {
                color: ${theme.colorSuperlightText};
            }

            tr.active {
                background-color: ${theme.colorWhitelikeBlue};
            }
        }

        table.featured-list {
            margin-left: ${corplistWidgetTableSpacing};
            margin-right: 1em;

            tr.active {
                background-color: ${theme.colorWhitelikeBlue};
            }
        }

        div.tables:focus {
            border: none;
            outline: none;
        }

        div.tables > table tr {
            line-height: 1.2em;
        }

        div.tables > table th {
            text-align: left;
            color: ${theme.colorLogoPink};
            padding-left: 1em;
            height: 1.5em;
        }

        .labels-hint {
            padding: 0 1em 0 0;
            color: ${theme.colorLightText};
            font-size: 8pt;
            text-align: right;
        }
    }

    .subc-separator {
        font-size: 1.3em;
        vertical-align: middle;
        color: ${theme.colorLogoBlue};
    }
`;

export const TtMenu = styled.div`
    margin-left: 1em;
    padding: 0.3em 1em 0.3em 1em;

    .tt-suggestion.focus a {
        background-color: ${theme.colorWhitelikeBlue};
    }

    .tt-suggestion {

        margin: 0;
        padding-bottom: 0.2em;
        font-size: 1.3em;
        text-align: left;

        span.num {
            font-size: 70%;
            padding-left: 0.2em;
            color: ${theme.colorLightText};
        }

        a {
            display: inline-block;
            padding-left: 0.4em;
            padding-top: 0.2em;
            padding-bottom: 0.2em;
            padding-right: 0.4em;
            text-decoration: none;
            color: inherit;
        }

        a:hover {
            background-color: ${theme.colorWhitelikeBlue};
        }

        .found-in {
            display: inline-block;
            color: ${theme.colorLightText};
            font-size: 70%;
        }
    }

    .hint {
        padding-top: 3pt;
        border-width: 1pt 0 0 0;
        border-color: ${theme.colorLightGrey};
        border-style: solid;
        font-size: 80%;
    }
`;

export const LindatPmltqLogo = styled.img`
    cursor: pointer;
    display: inline-block;
    vertical-align: middle;
    width: 1.7em;
    margin: 0.3em;
`;

export const DictLogo = styled.img`
    display: inline-block;
    vertical-align: middle;
    width: 1.2em;
    color: ${theme.colorLogoBlue};
    margin-left: 0.3em;
`;

export const LockedLogo = styled.img`
    display: inline-block;
    vertical-align: middle;
    width: 1.2em;
    color: ${theme.colorLogoBlue};
    margin-left: 0.3em;
`;

export const DownloadLogo = styled.img`
    cursor: pointer;
    display: inline-block;
    vertical-align: middle;
    width: 1.4em;
    color: ${theme.colorLogoBlue};
    margin-left: 0.3em;
`;

export const StarredImg = styled.img`
    cursor: pointer;
    display: inline-block;
    vertical-align: middle;
    width: 1.4em;
`;

export const TrLoadMore = styled.tr`
    td {
        text-align: center;
        padding-top: 1em;
        padding-bottom: 0.7em;
    }
`;
