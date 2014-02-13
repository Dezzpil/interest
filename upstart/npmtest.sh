#!/bin/bash

if npm test &> ../logs/npmtest.err
	then error=0
	else error=1
fi

exit $error