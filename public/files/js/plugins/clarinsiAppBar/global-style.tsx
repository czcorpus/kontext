/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
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


export const GlobalStyle = createGlobalStyle`

    #common-bar {

        background-color: transparent !important;

        height: auto !important;

        .user {
            padding: 5px 10px 5px 10px;
            margin: 5px 15px 5px 5px;
            position: fixed;
            right: 0px;
            top: 0px;
            display: block;
            background-color: #428bca;
            color: white;
            font-weight: bold;
            border-radius: .25em;
            font-size: 16px;
        }

        .user a {
            color: white;
            text-decoration: none;
        }

        .user a:hover {
            text-decoration: underline;
        }

        .user.loggedout {
            background-color: #d9534f;
            z-index: 1;
        }

        .lindat-auth-bar {
            background-color: transparent;
        }
    }


    @media (min-width: 992px) {
        .lindat-footer-content {
            flex-wrap: nowrap;
        }
    }

    .lindat-footer {
            color: #606060;
            text-align: center;
            margin: 0
        }

        .lindat-footer h1 {
            border-bottom: 1px solid silver;
            font-size: 14px;
            font-weight: 700;
            line-height: 25px;
            margin: 0 0 5px;
            color: #606060
        }

        .lindat-footer a {
            color: gray;
            font-weight: 700;
            font-size: 12px;
            text-decoration: none
        }

        .lindat-footer a:hover {
            text-decoration: underline
        }

        .lindat-footer ul {
            padding-left: 20px;
            margin: 0;
            text-align: left
        }

        .lindat-footer li {
            line-height: 20px
        }

        .lindat-footer-main {
            text-align: left;
            border-top: 1px solid #e0e0e0;
            border-bottom: 1px solid #e0e0e0;
            box-shadow: inset 0 -1px 0 #fff;
            background-color: #f8f8f8;
            padding-top: 20px
        }

        .lindat-footer-content {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            justify-content: center
        }

    .lindat-footer-left {
        flex: 0 0 auto;
        order: 3;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding-left: 15px;
        padding-right: 15px;
        margin-bottom: 20px
    }

    @media (min-width: 992px) {
        .lindat-footer-left {
            order: 1
        }
    }

    .lindat-footer-text {
        flex: 1 1 768px;
        order: 2;
        display: flex;
        flex-direction: column
    }

    @media (min-width: 768px) {
        .lindat-footer-text {
            flex-direction: row
        }
    }

    @media (min-width: 992px) {
        .lindat-footer-text {
            flex: 1 1 auto
        }
    }

    .lindat-footer-text1 {
        order: 1
    }

    .lindat-footer-text1,.lindat-footer-text2 {
        flex: 1 1 auto;
        padding-left: 15px;
        padding-right: 15px;
        margin-bottom: 20px
    }

    .lindat-footer-text2 {
        order: 2
    }

    .lindat-footer-text3 {
        flex: 1 1 auto;
        white-space: nowrap
    }

    .lindat-footer-right,.lindat-footer-text3 {
        order: 3;
        padding-left: 15px;
        padding-right: 15px;
        margin-bottom: 20px
    }

    .lindat-footer-right {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }

    .lindat-clarinb-logo {
        background: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALAAAAApCAIAAAAavDSCAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA+lpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlUmVmIyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChNYWNpbnRvc2gpIiB4bXA6Q3JlYXRlRGF0ZT0iMjAxNC0wMS0xOFQyMjo1NTo1NiswMTowMCIgeG1wOk1vZGlmeURhdGU9IjIwMTQtMDEtMThUMjE6NTY6MDQrMDE6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMTQtMDEtMThUMjE6NTY6MDQrMDE6MDAiIGRjOmZvcm1hdD0iaW1hZ2UvcG5nIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOkU4NUQ3MjBDNzZGQjExRTM4M0U5RDczMTg2ODE4NzJDIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOkU4NUQ3MjBENzZGQjExRTM4M0U5RDczMTg2ODE4NzJDIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6RTg1RDcyMEE3NkZCMTFFMzgzRTlENzMxODY4MTg3MkMiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6RTg1RDcyMEI3NkZCMTFFMzgzRTlENzMxODY4MTg3MkMiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz4piyNrAAAdC0lEQVR42u18d1STyff+i66uBezuuq6ua0dAUQGlo9g7NtC1uyoiHUIJkISOFOko0pugoFSld5CO9N5CC53QyZ+/OwkiJTTX/bjn+/M9czg5ycy8U5655bl3wGg/nh/PmAf7sQQ/nh+A+P/0GRoaHh7+Z4Bo6ewvqm7LKW/OLG3KraAU1baRW6jTN6lq7Cwjd5TVd5Y1dBbXttc0dX31BFo6+0rr2isaOioaOqGUkjsq6js6ewanb9XTP1xZ31ECDRs7GQ3HlnLUWwfMom/abjp6Bsrq2krJ7fQmnYXVLUzf29LVX05uRwODzus7y+s7qhs7J/Q8MEQrr4M67WWNXUU1bVDhewGib2Cok9r/NYDoH6JllzU5BmXJmASfV/E6puAmLud6QtH9As77jl6Ankv8u4SSzOIGppv9Lr74Lsn/iprPFZzXHZK/d1TBV08gJLnskpq3pIaPpJYflMvKHo+MAxNya6ZvBTtn4pV0Sd1HUv0VtJKitx0tV7V8pbR87+q91XCI9I8tbGzvYdpJdXOXvlvcJWUPSU3fq+reilbvi6pbJlcDgOJfRF1S8ZTE+6Kaat6aL6KaxvcJ2NJ8ES2p+eqKiucNwhv38E/fUUh09A63UIfnBoiGth67gHS+e88xPk1sl+KXwg5/lTAORYxbdb4okfeuvWtYdv+kYxOdWc0mQsS2PME2PFwnrusRkf/Vozf0TMS2yWI75dHbuVSwP6SXChMcgrJmbPjQLATVhzFwqWIcSthOBWyHwshfxgeYCKcyi4C2nEUI7D2TIzFMe2gSjG14hCpvkTmp7AmiZXK1wWHaaVUvbKM0GiG8aLv8lksWiZ9qxwlqGu2sujcaz5o7q8T1XoTmfEdA9AGIKYNDswdEeX3nOTVvBIU9qpigDiZKxIR15glozxfQhr8sAjqYCAF9z6O+8rRxTlnT5B4Lq9v+uGyBHUQ97L5mFZVZ+XVDr27qktL2g23DxEjzDuliYrqYEAHj1ZA2C5mxLdEtYelRfaiMHdJlESP9PLaIEn8SJmBQxEgYrybGpazrFs+8E9d4bJ8amiyfxkPTkKb2XubgexqM7VdHHR4ioUFyq51R8cyrpIytI2MRtkRcD+DC9ZdNSGol7bs+Dd200pbZAQLk5ylV7wUH8BhsvCgJLegBzfUXzY8peUjgX53Gee2+bf/TEV04CssEdYgucUxFz6cKysZLFtAQAMElafUhreLrxu0bU/jbOVNsD27hEf3rpDdrz5oidHKp8N22TykgT99WxzV+yRE9tJ0iBK479j6R+f5xRdBhQHwxfNB4EbXhojkmRJ8jh9JpJffC6tbJnWg7xWJ7RwBx3ySooY05IP42DsL2qY8gDIoIYT636m39AHLrF8XxyCxkyWFdbIc8xzXrd8ll3xcQvcO0xGra0IyAAOnnHJq94CAe49fGQObvU+O96+AWmlNQ1VLf2tPY3guqBE5tcj5Z2ijwsLRTZQNz4+hbAULe6j3LXhz0s/WadWlt2wXNV/NhVNyqP4vraThGzQIQ+hg3DvYJ0DwBuK1d/ZZ+qRjMVJQAOoX7uk1EWuU3AIQwEYkKISLGj1/CryVtGtzZO/gfBARAIaeB1to3EyBK6tpOKnlgu1WQ6NuvLvDAMXSKoVc2dk5j2X0TQORXtYhJO2FbZUHC3zUKhG+8I/PXn32K9phPQ1TWhdo/NDMg9uBAy5zCeU34ta2rX80+kg4IIkgI3lt2cTk1Xw8IkyBUTUhn+Wnjgw8cMX4tJHt41NlEiap24YxRPjINWfyfAQQyLQdpTYMzASI2p2btGRNkPdDFg+mrlK972TcBhKV/2qpTRtg2uXWnjcEXQHOgDorIOKOl36e2/oyJb0zBzIAAlSFK2ixlpeUSq+uRQHKL1/dIILrGXSf5b7hghowhAW1suxz4TSAz/ikgDuI3XbUMTiq9qOULtipaRh4NNnFdA48EkE9KNuHLYDzb/yuAaOyjeWYPZjVMC4jw9MqfQe+CvhAkwHa+jiv8XoAA5XVZyw+J3/3qR+RcRwkAXfeEZTBCbtUFQjqn1byHpgcEGHF8mixwLmF7wDIFFwDMZD4NZBiBJoK/cJS5cduuPAtJYb5Dc1EZatDhn5KWIHsKqlvPKHnMg+mDKcanwXZM3zYg447huxXHDcHB+R8AAlwISmtfZV1XZV13JZlaWkMtru0tqx+oogzXttPqu2jZNVRFp4x9CqFn8VEu0TUTbOUvgIjJrgbHAU0D1OF+deuAtO8FCBDg269awvItOqqvah8FG98zMNw7QIvMquK754DtVoXjuPqUUXZp04yAAPXHIkpcJkxYIUJaKKg9Is9FSPMPkX45Zbz/jr3/1Lifg4QAQPBp/H7ZoqAKORcfixoOSTvNB8MCsCigveSY4bbr1ovB6+FU5pD6FwFB7RmqJXeVVLTEpla/eV8SEl+d8omS+qktuaDzY0lPfGFfZBHNJbX3pF4UuEIYtxK2RX7ZKRuXqHLmgICNFJJ+iewjMJW5cWdUvICgnIqLjPhYMTA0K0CEp88ZEHJW75fCyeZSXXva+I7BWxv/NFOf5Gd+KSB+ue/ao575tZYI65Bc4qj9w9N5GSBjRIlbpaxJrnFmr5L/0vNfgxCvCZhYekSP8DKmjTowzTDmJiHogMj/7G3GZFXz3nFggeZgpgAQoROwzPaockhZ/RuA6O8fLippeh9d5PsuJyu/gdLWPxX35JlIxg49xfjoAxPVwTiUbxsEDzMFBBxBEyCC9qgg21uYOO8A/qiC+wQWAYR5ZknjXT3/XVeevU0ongEQu5EBP4GlmUz9Do4fO/C+Ao+d0NmCowziarfKPC6VeZzK8JcFDN79anR3kcgiqLPrph2ZQp3Ryzj62cuAF90zfIf0xUH8AlGiJOF1T//wvwQIeMJSyjbDOsCYGe4oUCn/DiCqatv8ArOCI/KbW3pmrOyWWIeJPMX4NUeGtEvxqrZ/R+8UPAQw7bwgk0Hjwn4IE34SIW6SMBOVc5UkvLmhF3BRy09QxnnzZYsloFP4tYWeuDC1xb4Agl9r9WljaKVqH6loGz62KNlFKNiE3zUIAFKovnXcNIKSSn4FcxIdbhLnLbsbRP+Laj4X1X0k1H2AhD4i77oGLF9wEESIQJT5RHwaGp4JEMqeo98DkyYOlilQriIEVhEiqMWB4RkBoT1LG+L3S+MAAR0D5wFGMbJd4Dge/lcAkZBaHhKRX1Hd1tM7NKv6JZ2/XfcGax3jUwcjd+EBTX3PVNiAnqmYytjsmsOP6cY8wAJ2hRftKywrC7geQBTCZx51NH+w0dgVYS0mYwLCUX9ctkT6W4yEWMJDumBsgxc+vugtFSMt2K92g+Rf09w9tvlVwmvEJHIo7bpu7RyWA7+iuFEjKlVNXcAgPTYPQcMDp3+fuhTxTXMHk33S9UhkPWqAdkKYcEJ1nNvpF124+dxTZFTyam44YxI+tYmj685gKgEQ6tLmoc0dzD13adMQOiDUN1y2LCe3jf0JMOH+IXf9GWN0wIAE262y+7rN+7Rvw1T29g3HJJZFJ5SSG+cQPuwbpkVmN94mvtt43oz3mrWpRwK5FS1g2yCtb6pYRnpx4xOzkN1g1sFawCFDJjojnKGECPm96NhtvmB65IGjsk34ZEIXIAX7De4cqgkGIBzH7fJMylY57Le/r+B9aylfABGXXYNeCmhb/+A8zqutm4kEehVdgPGooZDELkWWA5qezGJFjy3C0CZtloHBc96x6+odHBsLVbR5j44IjO33B3tv20VnVk3uASykR2bB2J8yaDDbZIGlrWBGxAEbcg7iFFBtm+zCw7oJzPgMK/80FkG6p7NJetUxfaew3G/iSkQnVcQkVbS2980ZSXAq0js0PUvic8mj0XAwprqGEIKZRztBkYemlqnYhp9S9uT/+znXNatdVy333rAVlnY6o+YN33tF5n+qokBwfHJb8MXPq3iKPngh+sQFGCQxWVcxOSYFfj14w0bOInQUEPBS97AcoYeOotIvRW7ZPfNNYSoE04sbJDR9RO8/F3viDD1Yvk7t7huacC713OLFHjuJwRiknW7qBVSMj0uBYSTy8KWYjDNU4LljbxuQNjhJcTS19RCcYkRu24vJQD+Oj82CIX49eTD1rVQl6/cidxxEHzieVfYIZebBdvcNXie+EX30UvSeA3ikbh/+KSBgF1Oz6z/ElffOEQyw61H5LfL2aX89TXr0oqSkaeK0+2fMhwBLs6i6NTKjMjSlPDm/DmL5M2qq6qZOcnN3fRsVqO6pCgRNyK3UwprWqIyq9u6B0Y2srEdtG1p76lq6Ke29g8wUPLVvqBb1j/qpa+ququ/oHW8bogpNXbXNXY0dPZD3UNvYRekct3KQZlFHQW+BChUox6J9Mu/ZQR2oauiE5vAWeBfogu5eJtweaEzIAYC5QB0ypbu6qYOpsAF41bdAnV4geeso3cwP/eDgwMDAbPa1tp7qH146ODRnJEXmt+5+4INtV0TiilvnHPFDaWPPzOHvH8/3enp6ZnYTmlsHwpPJ7V3DX9G/7PMUbDewI3jkAx/QwASI3jElPwDx332oPb0z1knNa7HyzAXnIiaxNDK2KOhDrn9oVmhUXlRCyYeYoo/Ztc0tzDsBy/OGWTzGBRFgHeRzguXOowFm+/cBxNDw/+Itvf3/+isGhv/dzqfhygpLKS4Bhc888yKTqnILG6rJ7a0dvZ1d/R2dUPqaKdSi0mYAxMecutDo0qikKkrrxOUw9C/CDhpinIrIf9wqB95W/CQreEpAACfhG11g6puKd4rVcIw28EqyfZvhH1ecW0kBrT+qc2F9ItMrrd+kW/mn277LsA3MHFeCsiBMZe6TEphQwmA2wQAM/1jx1DcVerN+/dEzIg+iVmPfm5xHdgjMNPFO9orIq6KnH7ZTB4y9ki1ep9ow+n+XiV40WgIz7YIyzf0+wlsge2/EbMyotA2AIaVNGBL0YPcu81VUQe4kEja7pMn6TZrN2y/dji12QVkktwTnEDiA0/l4LQWF2a7u6fYvM1+4Qsl64fa5uGY+d8lx9qiJTaT1TicGaj7vIpVuAzKevPKOqNS65My6V+E1b+KbgHLoH5iSvW7v7K8md6XmNkQk1aTmNre2D446FxD1vm0Wt1zcCGh73uvWHqHZPZMAzgQQxXXtYKWfkHXZImGGovgoTqMJ3MCqYwY7rloevu2g8uz9WJNbxzlu3SnjVYdIq04asYmR2BDn87mIEhcf1FzJr6XrEs8w3MBK1XaMYRPUWXPCaNUR/T/Pm4alfmECoAagYds5UzZunISqV04F2ramjt5t12xYBbWh52VipBXiuqtPGAIJDWXlUf1lh0jLD+su5dXYIK5n7J00MiSn2N/PmKw6rAtDWiJC+Jlfi1EWCWivOKy39YLZURknQOpY5huyRFedNFx93GDNKePl4nqsY2chQoBYNst2+cs4r/KG6VJkyampVnt49TduMP5zu97637VWL9degwr6sHal4abNNgL8kVo6PfWN0zgCRU1Dz0LLb5olST/P8U+jfKroic1ozi9tLarpSSkdmDqAM9FPLK3qzCxsTc1rD81uVnTOvGWRouhW7BxJ9osrfR1TGJ/DnEGeCIi0wvrL6j6IgNoqi22TR8QDMFEQJIRwCIcyylJc/1DskdNYNgmOzjyoD8QDr8ZPB/CLYN0PorKYX2uxgNbP+9SW82rquydQP4OR4ByHSAggl6BwqUDQJK+CMipvXN/nsgKNs+bOWSUPRrYjUB2bJK1QcgO3KgsQSjwoCjryl/EB2LOd8msEtE18RkL2Oi7xC1BoWx7jw68UI208ZgBl03HDdYd1WWAuHCgzFDIt3o/BYmRmFSP+gqI5fJqM8TMmAtku8HneZhlJnFdlc/c029BeVmb0+xblJZja0gXEX9aacnGYcrI/RWWX/uaNmsuWyi7GtFeuSDA0nQYQck4ZPx+zwHbhMB7dLde9nvoWkSlIIJS30FKraD1zcS4QMxZN5rjnhR0gYpzArxs/ME+cvgk2gWQUhTgC+CS8GvOFiRslzMUU3CVJATf1313E+wnKuf0qrgdJpB7jE6mNvZNZjxnAbq05b6poGwksoZ57oq57or5Xkr5XIqgbVdsIgOQoWQC/okUHNhdMG35EQ0kR3jR8JrA9IvJWQ6R4q+xFjVfV9KxucO1kLd8/eBoibREmbxN+Qctv+WkTFGIQ0jkg7XTvaYisdfg9oyAZkyCfyDxGJwaeictOgLJUXn/BzNAzyT+xBEpgSpl7RN513YAFwGoDXLhUNByi2j47vVGZ1ZCrh7oV1Lms8wbGr+eZhP7CRDwTie4JD8yCrV5/rJ0WEG3FJc927cOzsmqxsr29K9OYllWfkk5OTmtIzSh6HegsdlJt6UIN1sUvhY9M6RmW9K69aI3UvDAe48HN51F/YD6SZZPZQPvUNDejBHgiOacsFADihWiWNrZLfpuExYesulkBAnS8hW8q7CtKkOHVFJJ2AoppQm2n4KyXQVktHeOsFSMABMR22RU5btlTOmbmShAgQDaIEBcc0ZsHhC6cS16Nv4j+DD4RrIrVAK8tTy6qv6pilub/sbB+53UbJLF4Ncx8kofGsSYjQgi2cBmgarscp5Rl0fh8SRCV20DeAI/JoyFjHtb0ecAAiAXi9HQQPs23CSUTztksHwQI9r2arEs0WH+O1zOZEJH0v/MIhAd+OZuXhNRUPVhG1K89aQ5ULCOTAzI/Lmi8YhAyiXW09MbZCgYGzOs7BkXwEfMg9COozQL0MTduy3lTyC2dFSDgkomEhg+SmQfx686ZRmZUzXIVRgDBjVt22hjO1j2T4PtPg+8ZB0J+uoVfKnNAcEGSC+Gq9mugMhcfhrgwDgQSBAXg17fxxWvhcG95IqH+qpIZS5/A2NG9CBAG7gldfUxkKB0QBsBtb7pg7hKWm1/ZUlDVWlzTCikUQLf/BEsDOm4PTssxpp06MA4QKFRNgHjefZNgkEn3jINu6vrf1A0YZc9mAkQpAEKLbRlh+Sp7HuG3dx8H3JEOuP3I/+bfL4WOGvy6EX5yPHy8MjJmqh5iy4c3SrlieyCoqwWoXcSriX8eC9+HfGq/YJ511bowsmgGV6qwaVjDu+CsUapdVFNNJ03asYiFh4CUvrAO8P37pKyLq1tmBQighDlu2CJhvhd3VtUb7iHNDRAo946A8AQaBwqYIDsU/jYPZQ4ITmWw79QcIiFd/ZiiO4oR71X75ZSJsm0E7N8voBG2yk4FiPgxgNBzS+jsZQ6I5SBmeNRh79ecMtp41mTTBbPNVy3/vGSBvgebg0OR9YheTGb1GD6bDggheuIC2CWMWaBLHPJbrlhSuvpnLyG0l63QXb0Oz8aqtARjFBAMCvQPpls40u1eTt8JzrN4xVlb0KQLhbRvEQICc7pJ/iU7rzssEiIuFtDdd9fTK2HEHmzpp3mltbxIbK34TJBmk/tFVd4sE9VbwE9Yc9rqHCnS6X3dX4aRCw4bYruV/pCwJHnltgzMzobIKm3af/c5kqX71UVkXKpnHUMbAcR+9SXHDQTuPT/+xAU8lJOPnfdds8G/jJ0KEGDzw2Glh6Sbee8/x9gVIPuB7aQRmAWLIFDJrghR76qZAKE/PSDoEVcUK4cPYB1DoA7gfhD/y2njCyqePlEFY+/cfQYEivuzX7M+8cTlJFxWk3EW//sFxNxnowpHATEiIQ6KhCgpBcspBMrKB8spBj6WtdrHR1yz1lFQLMPBmTbM3Dhs6KFlNtLefqx1CEh/E5VX3tiVWEP745Y73XaG8ativPhz2m/RutVSpQzDt1yy/eOM3XmtD4lFKNAq8zITE9HD9igjInK36pqTZkHJVWWNva/jS0HdJ+TWFjbRsiizAwTkJdw3DEQWuKDOMnE9U5+U7r6J2rO4uhXuRExgDkYAwaG0/bpNRmljdXN3bUt3XUtPdjmFKaoYgFjIr/XEIowRlwJrf98NdCZQRgwjuYhT+R8CAqkMLhVIG1a2iXgenI1ziGQ7Tg+ICxHO4bzrJmXWjAACjM0DeIfg7BoKzIIKBYKcWSWNc7EhuMGG0GRdHKVJog0MIrIMYlC9/UNd1FxnL7MdHDKLMTN2ruYc5iGutHraBJoipHAQEzNDltZheqLNfrVNV61zavr/Mo/FhEjYLgUUi+bTOaMVlFHauVUmBDuog8jpY4aAoRUihMDEiXlMnyi0eursvIzA+GJIG0G7she34YK5xvNouJeXUdKYXdackFvnE114EecleM9hAt85Aohdijtv2BbXtlE6+xmlvWewubO/rL4DbsqOtez0PMCGUAFAyD17P5pAG5RYyn71GSOf/ZsBYoc8BGnzP/u0943eLUJ5XCqQCTb5yvJnQKA0LffwPNARLV0DMH740EYdBHzkVbV8Km9u7RqYhVG5WJN1UZyu8YRfy4I/OBwQBs+TuG5t8Tsm98+6h2hVkxR1ag1t000fbD8e2w+ON46FX0tC47XPxw62yy/piUI6mLguOBFsJ028omquW+XOO2yCVDBIFC4V9ksW2ZPQ3DNMy5vlzS04r0+eha0Eyx9sLkgX2INjO2G457Y93/0XYGYiCxwE+5+PIR1+7IICIJbCUu5RXXrC8Lii+1W4UIv3hUQH+CCp/VpCzfu0vCv4L6MRRT1I1ONQXngQL/csbOyV6gCUX0T3JwGUu5QAENVN3cwBAbkaQEvsVzeYGhCQ7gw5CjsuWwD1OWJt1bTBFc157Irz+DSB/JhgJ0Zn1fzESNEW1AbVeQWPBn8Z73uZPhEpndcQcFcwDy2pbZuOhygts9iBJAS4nW4nLmS9dM2wd0q3cwTu8qO1g+uJczorV+KWspixczakZ0xuDqFHporE6G0Zu5TDCkGdtZBuruCaXkCu7KD9cd8PO6iFrkzCmHk0uG/ZN1CoxU20U/iQdeKGawS12C+aG7onMCfQqLSB2QCCwSTi7CN/PfsUrnCxgKjg0URnEbQvoqc05wPft099y3kzqzdfcrLB6WeF7DyoBiODfQJtPVoAqjsUFnKpGLonjiYwkkBl7FQE+xlURvsY7TNMT35ZfsIIwXG7/EWcdyUztzMmu2br5Wf0VB1Vfdf4TmZMDUrYB4xuebJDwixhDCXnG1v0+3lTsBOBPdNyjO4aA6borGoWMSI9LRslnY+bBWMikM6j6lnTMh0P0VpSZr6NU5NtCWH5asAEbun80aK6FANfVH3ZQt3f1oXIqDCN7jROHeyMy2siuqXaBmTWNIysiYLzp1VHTSG3+6c9qr8d1YelGFH9nUNeUcWWvqnpU194hEXvHp4dIBgbk1XShH8ezf/QcfUZk3mHSHB0lp8y5rxpe17d29LvI+jU0VwmmJe8VTiQvqA1Vp4xWXEaivFogW+WHNVfddTAyCOJwRODdSZv9QFst19OGknqvKkdnxwAx/2m/ttf4aX8WnAjI44ZvQrG4OYrz+DeCxDMss/CmKY6grcCnSwQ1Oa8ZjU2IQX+X4Wktt88Aa0VJw03SJiDizv0ecrOYblsxw2XnzKaPAvGROBIQFJn5TTU9fBwSWAIUNdGGzabbWaHYrJ55+eyw3jTNtPtnK4nzmc5udH6B5luUte0/7Kin17ny9EdotkEFZxVfQUcv2fYnG+UdwzOGhAje9MzCKxcXmVLfG5dfG4t+CCwFo2QyzkwcRqldW0ZxQ3g4oOpMblAlnZKPhnE9QjHPkArrW3PKG4C5wJujU4mESCFBCJP0CqvnEJhlpEFGSuZdLMG3ggbzDT8CJwKDBgKaP2xmAOtBf/fI6MYNQeCa2zSNpDx6UUN8F8xmM4CbiSAiZ5V3NjZO92mUckNLfn5zZ/yKHkFEwp82VZSRq1vAIZqqlM7Iys9oQKMpbGtFzZlYO7JMr3DcwTEj+d//MyGDx2k0Qa+0etmvv394/k/g5t/8vwAxI/nByB+PFM//w9A7ilcdUR5pAAAAABJRU5ErkJggg==') no-repeat 50%;
        width: 176px;
        height: 41px;
        display: block;
    }

    .lindat-clarink-logo {
        background: url('data:image/png;base64,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') no-repeat 50%;
        width: 176px;
        height: 41px;
        display: block;
    }

    .lindat-dsa-logo {
        background: url('https://lindat.mff.cuni.cz/common/public/img/dsa2017.jpg') no-repeat 50%;
        width: 90px;
        height: 90px;
        display: block;
        margin: 10px 0
    }

    .lindat-logo-mono {
        background: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGcAAAA7CAQAAADMBFz+AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA2ZpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDozQTlBRUYyREZGMTlFMjExQTIzNUVEQTVDNTc5M0UyNyIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDowQkIyOEMxRDFDMzcxMUUyODFDMEEwNEFERTY4RDRGMyIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDowQkIyOEMxQzFDMzcxMUUyODFDMEEwNEFERTY4RDRGMyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjY2OUI0MTY4M0UxQUUyMTE5NzY5Q0JCMjc4MDQwOUZEIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjNBOUFFRjJERkYxOUUyMTFBMjM1RURBNUM1NzkzRTI3Ii8+IDwvcmRmOkRlc2NyaXB0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') no-repeat 50%;
        width: 103px;
        height: 59px;
        display: block
    }

    .lindat-msmt-logo {
        background: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAABHCAQAAABPanbjAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA2ZpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDozQTlBRUYyREZGMTlFMjExQTIzNUVEQTVDNTc5M0UyNyIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo0OUJENDJEQzFDMzcxMUUyQkJDNkJBNTI2MTQ2M0JCQSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo0OUJENDJEQjFDMzcxMUUyQkJDNkJBNTI2MTQ2M0JCQSIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjY2OUI0MTY4M0UxQUUyMTE5NzY5Q0JCMjc4MDQwOUZEIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjNBOUFFRjJERkYxOUUyMTFBMjM1RURBNUM1NzkzRTI3Ii8+IDwvcmRmOkRlc2NyaXB0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') no-repeat 50%;
        width: 120px;
        height: 71px;
        display: block;
        margin-top: 10px;
        background-size: 120px;
        background-position: 0
    }

    .lindat-copyright {
        padding: 5px;
        font-size: 90%
    }

    #lindat-home .lindat-header,#lindat-home .lindat-home-item>a,#lindat-home .lindat-menu>li>a:hover {
        border-bottom-color: #ccab28
    }

    #lindat-repository .lindat-header,#lindat-repository .lindat-menu>li>a:hover,#lindat-repository .lindat-repository-item>a {
        border-bottom-color: #7479b8
    }

    #lindat-pmltq .lindat-header,#lindat-pmltq .lindat-menu>li>a:hover,#lindat-pmltq .lindat-pmltq-item>a {
        border-bottom-color: #292e99
    }

    #lindat-about .lindat-about-item>a,#lindat-about .lindat-header,#lindat-about .lindat-menu>li>a:hover,#lindat-events .lindat-events-item>a,#lindat-events .lindat-header,#lindat-events .lindat-menu>li>a:hover,#lindat-services .lindat-header,#lindat-services .lindat-menu>li>a:hover,#lindat-services .lindat-services-item>a,#lindat-tools .lindat-header,#lindat-tools .lindat-menu>li>a:hover,#lindat-tools .lindat-tools-item>a,#lindat-treex .lindat-header,#lindat-treex .lindat-menu>li>a:hover,#lindat-treex .lindat-treex-item>a {
        border-bottom-color: #ccab28
    }

    .clarin-si-logo {
        background: url('data:image/png;base64,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') no-repeat center;
        min-width: 100px
    }

    footer {
        margin-top: 0;
        padding: 0;
    }

`;