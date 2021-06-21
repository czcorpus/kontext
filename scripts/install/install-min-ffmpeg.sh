sudo apt-get install libmp3lame0 libmp3lame-dev

cd /usr/local/src
wget -O ffmpeg-snapshot.tar.bz2 https://ffmpeg.org/releases/ffmpeg-snapshot.tar.bz2
tar xjvf ffmpeg-snapshot.tar.bz2

cd ffmpeg
./configure --disable-everything --disable-network --disable-autodetect --enable-small --enable-decoder=aac*,ac3*,opus,vorbis --enable-muxer=mp3,mp4 --enable-protocol=file --enable-libmp3lame --enable-encoder=libmp3lame --enable-filter=aresample --disable-x86asm
make
make install