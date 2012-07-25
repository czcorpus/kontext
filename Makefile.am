# Copyright (c) 2003-2010  Pavel Rychly


pkgpython_PYTHON = CGIPublisher.py version.py tbl_settings.py \
	corplib.py conclib.py conccgi.py usercgi.py daemonize.py gdex_old.py

nobase_pkgpython_PYTHON = simplejson/decoder.py simplejson/encoder.py \
	simplejson/scanner.py simplejson/__init__.py 

pkgdata_SCRIPTS = run.cgi
bin_SCRIPTS = setupbonito2

EXTRA_DIST = run.cgi.in setupbonito2.in $(patsubst %,templates/%.tmpl,$(TEMPLATES))
MOSTLYCLEANFILES = run.cgi setupbonito2

mostlyclean-local:
	rm -rf cmpltmpl

DIRS  = css js img misc
FILES = index.html
FILES_CSS =	ca_bonito_common.css view.css bonito.css tables.css forms.css horizontal.css
FILES_JS = hideelem.js annotconc.js controls.js effects.js prototype-1.7.0.js \
			util.js detail.js tblex.js
FILES_IMG =	minus.png plus.png red.png grey.png edit-copy.png \
			edit-copy-selected.png sortleft.png sortnode.png sortright.png \
			logo.png lc_logo_small.png
FILES_MISC = clipboard.swf


pkgdatacssdir=$(pkgdatadir)/css
pkgdatajsdir=$(pkgdatadir)/js
pkgdataimgdir=$(pkgdatadir)/img
pkgdatamiscdir=$(pkgdatadir)/misc
dist_pkgdata_DATA = $(FILES:%=files/%)
dist_pkgdatacss_DATA = $(FILES_CSS:%=files/css/%)
dist_pkgdatajs_DATA = $(FILES_JS:%=files/js/%)
dist_pkgdataimg_DATA = $(FILES_IMG:%=files/img/%)
dist_pkgdatamisc_DATA = $(FILES_MISC:%=files/misc/%)

WSTEMPLATES=

TEMPLATES = freq freqs fullref reduce_form first_form \
	subcorp subcorp_form subcorp_info \
	sort view viewattrs widectx coll collx wordlist_form wordlist \
	concdesc filter_form saveconc_form saveconc \
	savecoll savefreq savewl savecoll_form savefreq_form savewl_form \
	addlngrouplabel selectstored lngroupinfo \
	document topmenu leftmenu conc cpa_form simple_search\
	$(WSTEMPLATES)

TEMPLATE_MODULES = $(patsubst %,cmpltmpl/%.py,$(TEMPLATES))

BUILT_SOURCES = $(TEMPLATE_MODULES) cmpltmpl/__init__.py
nobase_nodist_pkgpython_PYTHON =  $(TEMPLATE_MODULES) cmpltmpl/__init__.py

cmpltmpl/__init__.py:
	[ ! -d cmpltmpl ] && mkdir cmpltmpl || :
	touch cmpltmpl/__init__.py

cmpltmpl/%.py: templates/%.tmpl
	@cheetah@ compile --odir cmpltmpl --idir templates $(<:templates/%=%)



GETTEXT_LANGS = cs_CZ ga zh_CN zh_TW
XGETTEXT_PROCESS = $(GETTEXT_LANGS:%=xgettext --language=Python -j -o locale/%/LC_MESSAGES/ske.po *.py cmpltmpl/*.py;)

nobase_dist_data_DATA = $(GETTEXT_LANGS:%=locale/%/LC_MESSAGES/ske.mo)


%.mo: %.po
	msgfmt -o $@ $<

locale: $(TEMPLATE_MODULES) $(pkgpython_PYTHON)
	$(XGETTEXT_PROCESS)


SETUPDIRS = $(DIRS)
SETUPFILES = $(FILES) $(FILES_CSS:%=css/%) $(FILES_JS:%=js/%) $(FILES_IMG:%=img/%) $(FILES_MISC:%=misc/%)

edit = sed \
	-e 's,@libdir\@,$(pkgpythondir),g' \
	-e 's,@datadir\@,$(pkgdatadir),g' \
	-e 's,@pythonpath\@,$(PYTHON),g' \
	-e 's,@setupfiles\@,$(SETUPFILES),g' \
	-e 's,@setupdirs\@,$(SETUPDIRS),g'


run.cgi: Makefile $(srcdir)/run.cgi.in
	rm -f $@ $@.tmp
	$(edit) $(srcdir)/run.cgi.in >$@.tmp
	chmod +x $@.tmp
	mv $@.tmp $@

setupbonito2: Makefile $(srcdir)/setupbonito2.in
	rm -f $@ $@.tmp
	$(edit) $(srcdir)/setupbonito2.in >$@.tmp
	chmod +x $@.tmp
	mv $@.tmp $@

