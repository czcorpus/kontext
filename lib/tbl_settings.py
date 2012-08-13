#!/usr/bin/env python

tbl_refs = { 'oec_oup_shogakukan': '=doc.dialect.MAP_OUP,=div.url',
             'ANW_INL': '=doc.id,=doc.bronentitel,=doc.datering,=doc.variant,=doc.auteur,=doc.url',
             'iztok_caja': '=doc.domain,=doc.id',
             'bnc_test': '=bncdoc.author.MAP_OUP,=bncdoc.title,=bncdoc.author,=bncdoc.author,=bncdoc.author',
             'oec_oup_all': 'doc_domain,doc.subdomain,doc.id,doc.title,doc.author,doc.year,doc.gender,doc.dialect,doc.register,doc.mode,div.url',
             'cupclc': '=doc.id,=doc.exam,=doc.nationality,=doc.cef_level,=doc.year,=doc.first_language,=doc.pass_fail',
             'cupcic': '=doc.id,=doc.title,=doc.author,=doc.date,=doc.variety,=doc.genre',
             'cupcsc': '=doc.id,=doc.name,=doc.title,=doc.date,=doc.variety',
             'cupcac': '=doc.id,=doc.name,=doc.title,=doc.author,=doc.publisher,=doc.date',
           }

tbl_structs = { 'cupclc': 'g,err,corr',
              }
