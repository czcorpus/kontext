![KonText screenshot](https://github.com/czcorpus/kontext/blob/master/doc/images/kontext-screenshot1.jpg)


## Contents

* [Introduction](#introduction)
* [Features](#features)
* [Installation](#installation)
* [Customization and contribution](#customization-and-contribution)
* [Notable users](#notable-users)
* [How to cite](#how-to-cite-kontext)

## Introduction

KonText is an **advanced corpus query interface** and corpus data **integration platform** built around corpus search engine [Manatee-open](http://nlp.fi.muni.cz/trac/noske). It is written in Python 3 and TypeScript and it runs on any major Linux distribution. The development is maintained by the [Institute of the Czech National Corpus](http://ucnk.ff.cuni.cz/).

## Features

* fully **editable query chain**
    * any operation from a user defined sequence (e.g. query -&gt; filter -&gt; sample -&gt; sorting) can be changed
    and the whole sequence is then re-executed.
* multiple search modes:
    * concordance,
    * paradigmatic query,
    * word list
* simple and advanced query types
    * **advanced CQL editor** with **syntax highlighting** and **attribute recognition**
    * **interactive PoS tag composing tool** for positional and key-value tagsets
    * customizable query suggestions and simple type query refinement (e.g. for homonym disambiguation)
* support for **spoken corpora**
    * defined text segments can be played back as audio
    * KWIC detail with **easily distinguishable speeches**
* rich **concordance view options and tools**
    * any positional attribute can be set as primary
    * multiple ways how to display other attributes
    * **user-defined line groups** - filtering, reviewing groups ratios
    * tokens and KWICs can be connected to external data services (e.g. dictionaries, encyclopedias)
* **rich subcorpus-related functionality**
    * a subcorpus can be either private or published
    * text types metadata can be gradually refined to a specific subcorpus ("which publishers are there in case only *fiction* is selected?")
    * a **custom text types ratio** can be defined ("give me 20% fiction and 80% journalism")
* **frequency distribution**
    * univariate
        * positional attributes (including tuples of multiple attributes per token)
        * structural attributes
    * **multivariate distribution** (2 dimensions) for both positional and structural attributes
* collocation analysis
* **persistent URLs** - any result page can be easily shared even if the original query is megabytes long
* access to **previous queries**, named queries
* convenient corpus access
    * finding corpus by a keyword (tag), size, description
    * adding corpus to **favorites** (incl. subcorpora, aligned corpora)
* saving result to Excel, CSV, XML, TXT
* integrability with existing information systems


## Internal features

* modern client-side application (written in TypeScript, event stream architecture, React components, extensible)
* server-side written as a **WSGI application** with fully **decoupled background concordance/frequency/collocation calculation** (using an integrated worker server)
* modular code design with dynamically loadable plug-ins providing custom functionality implementation (e.g. custom database
adapters, authentication method, corpus listing widgets, HTTP session management)


## Installation

### Docker

Running KonText as a set of Docker containers is the most convenient and flexible way.

```shell
docker-compose -f docker-compose.yml -f docker-compose.mysql.yml --env-file .env.mysql up
```

(the `.env.mysql` allows configuring custom MySQL/MariaDB credentials and KonText configuration file)


### Manual installation

#### Key requirements

* Python *3.6* (or newer)
* [Manatee](http://nlp.fi.muni.cz/trac/noske) corpus search engine - version *2.167.8* and onwards
* a key-value storage
    * [Redis](http://redis.io/) (recommended), [SQLite](https://sqlite.org/) (supported), custom implementations possible
* a task queue - [Rq](https://python-rq.org/) (recommended), [Celery task queue](http://www.celeryproject.org/) (supported)
* HTTP proxy server
  + [Nginx](http://nginx.org/) (recommended), [Apache](http://httpd.apache.org/),...


For Ubuntu OS users, it is recommended to use the [install script](scripts/install/install.py) which should 
perform most of the actions necessary to install and run KonText. For other Linux distributions we recommend
running KonText within a container or a virtual machine. Please refer to the [doc/INSTALL.md](doc/INSTALL.md) 
file for details.


## Customization and contribution

Please refer to our [Wiki](https://github.com/czcorpus/kontext/wiki/Development-and-customization).

## Notable users

* [Institute of the Czech National Corpus](https://kontext.korpus.cz/)
* [LINDAT/CLARIAH-CZ](https://ufal.mff.cuni.cz/lindat-kontext)
* [CLARIN-PL](https://kontext.clarin-pl.eu/)
* [CLARIN-SI](https://www.clarin.si/kontext/)
* [Інститут української](https://mova.institute/kontext/first_form)
* [Serbski Institut](https://www.serbski-institut.de) (API version of KonText)

## How to cite KonText

Tomáš Machálek (2020) - KonText: Advanced and Flexible Corpus Query Interface

```bibtex
@inproceedings{machalek-2020-kontext,
    title = "{K}on{T}ext: Advanced and Flexible Corpus Query Interface",
    author = "Mach{\'a}lek, Tom{\'a}{\v{s}}",
    booktitle = "Proceedings of the 12th Language Resources and Evaluation Conference",
    month = may,
    year = "2020",
    address = "Marseille, France",
    publisher = "European Language Resources Association",
    url = "https://www.aclweb.org/anthology/2020.lrec-1.865",
    pages = "7003--7008",
    language = "English",
    ISBN = "979-10-95546-34-4",
}
```
