#!/bin/sh

echo "SEWOO"
echo "SEWOO CUPS DRIVER Mac OS Uninstaller"
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

if [ -e /usr/libexec/cups/filter/rastertolkt ]
then 
	echo "Removing rastertolkt"
	sudo rm -f /usr/libexec/cups/filter/rastertolkt
fi

if [ -e /usr/libexec/cups/filter/rastertoslk ]
then 
	echo "Removing rastertoslk"
	sudo rm -f /usr/libexec/cups/filter/rastertoslk
fi

if [ -e /usr/libexec/cups/filter/rastertovendorprt ]
then 
	echo "Removing rastertovendorprt"
	sudo rm -f /usr/libexec/cups/filter/rastertovendorprt
fi

if [ -e /usr/libexec/cups/filter/rastertogeneric ]
then 
	echo "Removing rastertogeneric"
	sudo rm -f /usr/libexec/cups/filter/rastertogeneric
fi

if [ -e /usr/libexec/cups/filter/rastertosl103 ]
then 
	echo "Removing rastertosl103"
	sudo rm -f /usr/libexec/cups/filter/rastertosl103
fi

if [ -d /usr/share/cups/model/SEWOO ]
then
	echo "Removing dir .../cups/model/SEWOO"
	sudo rm -rf /usr/share/cups/model/SEWOO
fi

if [ -e /System/Library/LaunchDaemons/printer.plist ]
then
	echo "Tiger"
	echo "Restarting CUPS"
	sudo killall cupsd
	sudo cupsd
	sudo launchctl  unload -w /System/Library/LaunchDaemons/printer.plist
	sudo launchctl load -w /System/Library/LaunchDaemons/printer.plist
	echo ""
fi

if [ -e /System/Library/LaunchDaemons/org.cups.cupsd.plist ]
then
	echo "Leopard over"
	echo "Restarting CUPS"
	sudo launchctl  unload /System/Library/LaunchDaemons/org.cups.cupsd.plist
	sudo launchctl load /System/Library/LaunchDaemons/org.cups.cupsd.plist
	echo ""
fi


echo "Uninstall Complete"
echo "Delete printer queue using OS tool, http://localhost:631, or http://127.0.0.1:631"
echo ""

