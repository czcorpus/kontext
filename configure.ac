# Process this file with autoconf to produce a configure script.
# Copyright (c) 2003-2011  Pavel Rychly

AC_COPYRIGHT([Copyright (c) 2003-2011, Pavel Rychly])
AC_INIT(bonito2, open-2.68, pary@textforge.cz)
AC_CONFIG_AUX_DIR(config)
AC_CONFIG_SRCDIR(conclib.py)
AM_INIT_AUTOMAKE


# Checks for programs.
AM_PATH_PYTHON(2.4)
AC_PATH_PROG(cheetah, cheetah)

# Checks for libraries.

# MANATEE_REGISTRY environment variable
AC_ARG_VAR(MANATEE_REGISTRY, [default MANATEE_REGISTRY path])
AM_CONDITIONAL(MANATEE_REGISTRY_STR, test -n "$MANATEE_REGISTRY")



AC_CONFIG_FILES(Makefile version.py)
AC_OUTPUT
