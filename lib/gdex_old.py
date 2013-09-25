# Copyright (c) 2003-2009  Pavel Rychly
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; version 2
# dated June, 1991.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

import manatee
import re


class GDEX:
    """\
    Class providing API for GDEX.

    After the creation of a new GDEX(corpus) instance, use the
    entry('"word"') method to load concordance list. Then you can
    change focus using the next_line(i) method. The other methods are
    using the focused line.
    """

    def __init__(self, corp=None, confpath=None):
      """Loads corpus to search for GDEX."""
      # nacti korpus
      self.corp = corp

    def entryConc(self, conc, collattrname=None, collattrvalue=None):
      """Loads concordance."""
      self.conc = conc

      # zpristupni contexty
      self.kw = manatee.KWICLines(self.conc, '-1:s', '1:s',
                                  'word', 'word', 's', '#')
      # zpristupni obsah korpusu
      self.word = self.corp.get_attr('word')

    def entry(self, word = '"example"'):
      """Loads concordances of the word."""
      # vytvor konkordancni seznam
      self.entryConc(manatee.Concordance(self.corp, word, 0))

    def next_line(self, line_num):
      "Moves cursor onto a certain kwic (sentence)."
      self.line_num = line_num
      self.kw.nextcontext(line_num)
      self.s_begin = self.kw.get_ctxbeg()
      self.s_end = self.kw.get_ctxend()
      self.kwic_idx = self.kw.get_pos() - self.s_begin
      id_iter = self.word.posat (self.s_begin)
      self.id_list = [id_iter.next()
                      for x in range(self.s_end - self.s_begin)]
      if not self.id_list:
          self.id_list = [self.word.pos2id(self.kw.get_pos())]
      self.freq_list = [self.word.freq(i) for i in self.id_list]
      self.word_list = [self.word.id2str(i) for i in self.id_list]

    def rate_kwic_length(self):
      """Computes a score of the kwic according to its length.

         Returns integer from 1 to 10."""
      length = self.s_end - self.s_begin
      if length >= 10 and length < 25 :
        return 10
      elif length<10 :
        return length
      else :
        return 250/length

    def rate_kwic_freqs(self):
      """Computes a score of the kwic according to the frequencies of its words in a corpus.

         Returns integer from 1 to 10."""
      low=0
      high=0
      for freq in self.freq_list:
          if freq < 300 :
              low +=1
# Doesn't seem to be useful
#          elif freq > 1000000 :
#              high +=1
      return  10 - 10*(low+high)/len(self.id_list)

    def rate_kwic_common_names(self):
      """Checks whether there is a rarely used word in the kwic.

         Returns integer (values 1 or 10)."""
      for freq in self.freq_list:
        if freq < 10 : return 1
      return 10

    selectedwords = set('it|that|this|these|those|one|again|other|another'.split('|'))
    def rate_kwic_dpronoun(self):
      """Computes a score of the kwic according to the dependency on the broader context.
         Considers words like : it, that, this, these, those, one, again, other, another.

         Returns integer from 1 to 10."""
      c=0;
      
      for w in self.word_list:
          if w.lower() in self.selectedwords:
              c+=1
      if c < 10:
          return 10-c
      return 0

    def rate_kwic_kw_position(self):
      """Computes a score of the kwic according to the position of the keyword in the sentence.

         Returns integer from 1 to 10."""
      ideal_pos = 7
      tolerance = 1
      score=10-abs(10*(self.kwic_idx)
                   /len(self.id_list)-ideal_pos) + tolerance
      if score > 10 : return 10
      return score


    def rate_kwic_whole_sentence(self):
      """Checks whether the word is used in a whole sentence.

         Returns integer (values 1 or 10)."""
      # add question mark to second search to allow questions
      if re.search(r'^[A-Z]',self.word_list[0]) and re.search(r'[.!"]',self.word_list[-1]) : return 10
      return 1;

    def rate_kwic_conjunctions(self):
      """Checks whether the sentence contains conjunction and the keyword is in main clause.

         Returns integer (values 1, 5, 8, 10)."""
      if re.search(r'\b(after|because|although|if|before|since|though|unless|when|while|as|whereas|since|while|until|so)\b',self.word_list[0].lower()) :
        for j,w in enumerate(self.word_list):
            if re.search(r',',w): 
                if self.kwic_idx > j:
                    return 5
                else :
                    return 8

      for j,w in enumerate(self.word_list):
        if re.search(r'\b(after|because|although|if|before|since|though|unless|when|while|as|whereas|since|while|until|so|and|but)\b',w.lower()):
          if self.kwic_idx == j-1:
            return 1
          elif self.kwic_idx < j:
            return 5
          else:
            return 8

      return 10;

    score_fns   = (('length score',        rate_kwic_length, 0.2),
                   ('freqency score',      rate_kwic_freqs, 0.35),
                   ('conjunction score',   rate_kwic_conjunctions, 0.15),
                   ('anaphors score',      rate_kwic_dpronoun, 0.15),
                   ('position score',      rate_kwic_kw_position, 0.01),
                   ('common names score',  rate_kwic_common_names, 0.09),
                   ('whole sentence',      rate_kwic_whole_sentence, 0.05),
                   )

    def weighted_score(self):
      """Returns a weighted score for the current kwic."""
      return sum ([fn(self) * k for name, fn, k in self.score_fns])


    def average_score(self):
      """Returns an average of all ratings."""
      return (sum ([fn(self) for name, fn, k in self.score_fns])
              / float(len(self.score_fns)))

    def kwic_score_comparsion(self):
      """Prints out a table of all ratings for the current kwic."""
      print ' '.join(self.word_list)
      for name, fn, k in self.score_fns :
         print name.ljust(20),   ':', '%2d'%(fn(self))
      print 'average score        :', '%5.2f'%(self.average_score())
      print 'weighted score       :', '%5.2f'%(self.weighted_score())

    def test(self, linenums=[]):
      if not linenums:
          linenums = range(5)
      for i in linenums:
        self.next_line(i)
        self.kwic_score_comparsion()
        print

    def best(self, maxconcsize=5000):
      """Returns the best example, according to its weighted score.

         Uses a faster algorithm, but if there are more than one examples with best score, it can return a different one from best_k(1)."""
      best = -1
      best_score = -1
      for i in range(min(self.conc.size(), maxconcsize)):
        self.next_line(i)
        score = self.weighted_score()
        if score > best_score :
          best = i
          best_score = score
      return best

    def best_k(self, k=3, maxconcsize=500):
      """Returns a list of k best examples.

         Return value: [(score, id)]"""
      lines = []
      for i in range(min(self.conc.size(), maxconcsize)):
        self.next_line(i)
        lines.append((self.weighted_score(), i))
      lines.sort(reverse=True)
      return lines[:k]


    def show_best_k(self, k=3, maxconcsize=5000):
      """Prints out k best examples."""
      for s,i in self.best_k(k, maxconcsize):
        self.next_line(i)
        print s, ': ' , ' '.join(self.word_list)


if __name__ == "__main__":
  print 'use help() with gdex or gdex.gdex or gdex_test.GDEX'

#print "Warning: this is test version"
#print "If you intend to use this module, comment the following inicialization."
#print ""
#
#if __name__ == "__main__":
#  print "module GDEX was started as an independet task."
#  gdex = GDEX()
#  gdex.entry()
#  gdex.test()
#else:
#  print "module GDEX was started as an imported module."
#  gdex = GDEX()
#  gdex.entry()

 
