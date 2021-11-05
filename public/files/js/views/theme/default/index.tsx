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

import styled from 'styled-components';
import {keyframes} from 'styled-components';
import backgroundSrc from '../../../../img/groovepaper2.jpg';

export const mediaPhone = '@media screen and (max-width: 479px)';
export const mediaTablet = '@media screen and (max-width: 1200px), screen and (orientation:portrait)';

export const mainBackground = `url(${backgroundSrc})`;

// texts
export const defaultFontFamily = '"Roboto", "Segoe UI", Arial, sans-serif';
export const monospaceFontFamily = '"Cousine", "Courier New", monospace';
export const condensedFontFamily = '"Roboto Condensed", "Segoe UI", sans-serif';

export const colorDefaultText = '#010101';
export const colorLightText = '#8d8c8c';
export const colorSuperlightText = '#B0B0B0';
export const colorWhiteText = '#ffffff';
export const colorDarkGreenText = '#4c5854';
export const textShadow = '0 0 2px #A0A0A0';


// general colors

export const colorSectionBg = '#f3fbed';

export const colorDefaultGreen = '#D1ECBF';
export const colorLightGreen = '#EEF7F1';
export const colorGreenBgHighlighted = '#F0FDBE';

export const colorLogoPink = '#E2007A';
export const colorLightPink = '#FFC8AD';
export const colorLogoBlue = '#009EE0';
export const colorLogoGreen = '#53AA28';
export const colorLogoBlueOpaque = 'RGBA(0, 158, 224, 0.7)';
export const colorLogoBlueShining = '#00CAF6';
export const colorWhitelikeBlue = '#e2f4fb';
export const colorLogoOrange = '#F0680B';
export const colorBgLightBlue = '#F4FAFC';
export const colorLightFrame = '#D1ECBF';
export const colorLockedAttrsBgColor = '#DEE0DD';
export const colorLightGrey = '#dadada';
export const colorLinkDark = '#02a';
export const colorTableEvenBg = '#F2F7EC';
export const colorFrameFieldset = '#DBE2D9';
export const colorTableOddRowBg = '#F7FBF3';
export const colorDataTableFooter = '#DCEDD0';
export const colorWidgetOrange = '#F76B0B';
export const colorButtonDefault = '#F0FAFF';
export const colorButtonHover = '#F9FDFF';
export const colorErrorInputBg = '#f8b6a6';

export const colorInputBorder = '#333333';
export const colorInputBorderDisabled = '#888888';

export const colorHeatmap = [
    '#ffffff', '#fff7f3',
    '#fde0dd', '#fcc5c0',
    '#fa9fb5', '#f768a1',
    '#dd3497', '#ae017e',
    '#7a0177', '#49006a'
];

// misc.

export const borderRadiusDefault = '5px';
export const borderRadiusMenu = '5px 5px 0 0';
export const portalBoxShadow = '0 0 3px #A0A0A0';
export const ucnkTopbarLeftMargin = '30px';

// forms

export const inputBorderStyle = `1px solid ${colorLightGrey}`;
export const inputBorderRadius = '3px';
export const defaultFieldsetPadding = '1.7em 1.1em';


// sizes

export const closeButtonSize = '1.1em';
export const navigIconSize = '1em';
export const pageFormMargin = '1.5em';


export const GeneralLabel = styled.label`
  display: inline-block;
  text-decoration: none;
  font-size: 1em;
  background-color: ${colorBgLightBlue};
  border-style: solid;
  border-color: #b0e1f3;
  border-width: 1px;
  border-radius: ${borderRadiusDefault};
  margin-right: 0.4em;
  margin-bottom: 0.5em;
  white-space: nowrap;
`;

export const DefaultButton = styled.button`
    font-size: 1em;
    color: ${colorWhiteText};
    text-decoration: none;
    padding: 0.3em 0.7em;
    background-color: ${colorLogoBlue};
    border-radius: 0.2em;
    border: 1px solid ${colorLogoBlue};
    box-shadow: 0px 1px 2px rgba(000, 000, 000, 0.5), inset 0px 0px 2px rgba(255, 255, 255, 0.2);
`;

export const DangerButton = styled(DefaultButton)`
    background-color: ${colorLogoPink};
    border: 1px solid ${colorLogoPink};
`;

export const UtilButton = styled.button`
    display: inline-block;
    border: 1px solid ${colorLogoBlue};
    border-radius: ${inputBorderRadius};
    background-color: ${colorButtonDefault};
    text-decoration: none;
    padding: 3px 8px;
    color: ${colorLogoBlue};
    box-shadow: 0px 1px 2px rgba(150, 150, 150, 0.9), inset 0px 0px 2px rgba(215, 215, 215, 0.2);
    cursor: default;
`;

export const DisabledButton = styled.button`
    display: inline-block;
    border: 1px solid ${colorSuperlightText};
    border-radius: ${inputBorderRadius};
    background-color: #ffffff;
    text-decoration: none;
    padding: 3px 8px;
    color: ${colorSuperlightText};
    box-shadow: 0px 1px 2px rgba(150, 150, 150, 0.9), inset 0px 0px 2px rgba(215, 215, 215, 0.2);
    cursor: default;
`;

export const FadeIn = keyframes`

    /* transition: opacity .3s ease-in; */
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
`;

export const FadeOut = keyframes`
    from {
        opacity: 1;
    }

    to {
        opacity: 0;
    }
`;

export const ColorChange  = keyframes`
    0% { opacity: 0; }
    100% { opacity: 1; }
`;
