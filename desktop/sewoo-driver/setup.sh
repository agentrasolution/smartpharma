#!/bin/sh

echo "SEWOO"
echo "SEWOO CUPS DRIVER Mac OS Installer"
echo "---------------------------------------"
echo ""
echo "Models included:"

echo "         SEWOO LKT Series"
echo "         SEWOO SLK Series"
echo "         Vendor POS Printer"
echo "         Generic POS Printer"
echo "         SEWOO SLK-SL103"
echo ""

ROOT_UID=0

if [ "$UID" -ne "$ROOT_UID" ]
then
    echo "This script requires root user access..."
    echo "Re-run as root user..."
    exit 1
fi

if [ ! -z $DESTDIR ]
then
    echo "DESTDIR set to $DESTDIR"
    echo ""
fi

SERVERROOT=$(grep '^ServerRoot' /etc/cups/cupsd.conf | awk '{print $2}')

if [ -z $FILTERDIR ] || [ -z $PPDDIR ]
then
    echo "Searching for ServerRoot, ServerBin, and DataDir tags in /etc/cups/cupsd.conf"
    echo ""

    if [ -z $FILTERDIR ]
    then
        SERVERBIN=$(grep '^ServerBin' /etc/cups/cupsd.conf | awk '{print $2}')

        if [ -z $SERVERBIN ]
        then
            echo "ServerBin tag not present in cupsd.conf - using default"
            FILTERDIR=usr/libexec/cups/filter
        elif [ ${SERVERBIN:0:1} = "/" ]
        then
            echo "ServerBin tag is present as an absolute path"
            FILTERDIR=$SERVERBIN/filter
        else
            echo "ServerBin tag is present as a relative path - appending to ServerRoot"
            FILTERDIR=$SERVERROOT/$SERVERBIN/filter
        fi
    fi

    echo ""

    if [ -z $PPDDIR ]
    then
        DATADIR=$(grep '^DataDir' /etc/cups/cupsd.conf | awk '{print $2}')

        if [ -z $DATADIR ]
        then
            echo "DataDir tag not present in cupsd.conf - using default"
            PPDDIR=/usr/share/cups/model/SEWOO
        elif [ ${DATADIR:0:1} = "/" ]
        then
            echo "DataDir tag is present as an absolute path"
            PPDDIR=$DATADIR/model/SEWOO
        else
            echo "DataDir tag is present as a relative path - appending to ServerRoot"
            PPDDIR=$SERVERROOT/$DATADIR/model/SEWOO
        fi
    fi

    echo ""

    echo "ServerRoot = $SERVERROOT"
    echo "ServerBin  = $SERVERBIN"
    echo "DataDir    = $DATADIR"
    echo ""
fi

echo "Copying rastertolkt filter to $DESTDIR/$FILTERDIR"
sudo mkdir -p $DESTDIR/$FILTERDIR
sudo chmod +x rastertolkt
sudo cp rastertolkt $DESTDIR/$FILTERDIR
echo ""

echo "Copying rastertoslk filter to $DESTDIR/$FILTERDIR"
sudo mkdir -p $DESTDIR/$FILTERDIR
sudo chmod +x rastertoslk
sudo cp rastertoslk $DESTDIR/$FILTERDIR
echo ""

echo "Copying rastertovendorprt filter to $DESTDIR/$FILTERDIR"
sudo mkdir -p $DESTDIR/$FILTERDIR
sudo chmod +x rastertovendorprt
sudo cp rastertovendorprt $DESTDIR/$FILTERDIR
echo ""

echo "Copying rastertogeneric filter to $DESTDIR/$FILTERDIR"
sudo mkdir -p $DESTDIR/$FILTERDIR
sudo chmod +x rastertogeneric
sudo cp rastertogeneric $DESTDIR/$FILTERDIR
echo ""

echo "Copying rastertosl103 filter to $DESTDIR/$FILTERDIR"
sudo mkdir -p $DESTDIR/$FILTERDIR
sudo chmod +x rastertosl103
sudo cp rastertosl103 $DESTDIR/$FILTERDIR
echo ""

echo "Copying model ppd files to $DESTDIR/$PPDDIR"
sudo mkdir -p $DESTDIR/$PPDDIR
sudo cp *.gz $DESTDIR/$PPDDIR
sudo cp *.gz /Library/Printers/PPDs/Contents/Resources
echo ""


if [ -e /System/Library/LaunchDaemons/printer.plist ]
then
	echo "Restarting CUPS"
	sudo killall cupsd
	sudo cupsd
	sudo launchctl  unload -w /System/Library/LaunchDaemons/printer.plist
	sudo launchctl load -w /System/Library/LaunchDaemons/printer.plist
	echo ""
fi

if [ -e /System/Library/LaunchDaemons/org.cups.cupsd.plist ]
then
	echo "Restarting CUPS"
	sudo launchctl  unload /System/Library/LaunchDaemons/org.cups.cupsd.plist
	sudo launchctl load /System/Library/LaunchDaemons/org.cups.cupsd.plist
	echo ""
fi


echo "Install Complete"
echo "Add printer queue using Printing Manager, or"
echo "Add printer queue using OS tool, http://localhost:631, or http://127.0.0.1:631"
echo ""
