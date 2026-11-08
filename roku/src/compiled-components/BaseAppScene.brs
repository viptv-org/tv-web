' Copyright (c) 2026 Roku, Inc.
' SPDX-License-Identifier: MIT

sub init()
    print "BaseAppScene init"

    di = CreateObject("roDeviceInfo")
    uiResolution = di.GetUIResolution()

    print "uiResolution: "; uiResolution.name

    ' Set a simple background color for the scene
    m.top.backgroundColor = "0x000000FF"

    ' The Scene template ships a Geneva-theme background Poster. Point the
    ' Scene's background at a black asset instead of the purple wash.
    m.top.backgroundUri = "pkg:/assets/black.png"

    myFirstApp = m.top.findNode("myFirstApp")
    if myFirstApp <> invalid
        print "MyFirstApp component found and initialized"
        myFirstApp.setFocus(true) ' Set initial focus to the MyFirstApp component
    else
        print "ERROR: MyFirstApp component (id myFirstApp) not found; initial focus not set"
    end if
end sub
