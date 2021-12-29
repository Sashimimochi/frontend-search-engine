import React, { useEffect, useState, createRef } from "react";
import Fuse from 'fuse.js';
import TinySegmenter from "tiny-segmenter";
import { trigram } from 'n-gram';
import moji from "moji";
import Paper from '@material-ui/core/Paper';
import InputBase from '@material-ui/core/InputBase';
import Divider from '@material-ui/core/Divider';
import IconButton from '@material-ui/core/IconButton';
import SearchIcon from '@material-ui/icons/Search';
import Button from '@material-ui/core/Button'
import './highlight.css';
import { ListItemText, List, ListItem } from "@material-ui/core";
import XLSX from 'xlsx';

const segmenter = new TinySegmenter();

function _tokenize(text, tokenizer) {
    if (tokenizer === "trigram") {
        return trigram(text)
    } else {
        return segmenter.segment(text)
    }
}

function tokenize(text, tokenizer) {
    const query = moji(text).convert("HK", "ZK").convert("ZS", "HS").convert("ZE", "HE").toString().trim()
    return _tokenize(query, tokenizer).map((word) => {
        if (word !== " ") {
            return moji(word).convert("HG", "KK").toString().toLowerCase();
        }
    }).filter(v => v)
}

function encode(text) {
    return moji(text).convert("HK", "ZK").convert("ZS", "HS").convert("ZE", "HE").convert("HG", "KK").toString().trim().toLowerCase();
}

function cleanQuery(text, searchType, tokenizer) {
    if (searchType === "plain") {
        return moji(text).convert("ZS", "HS").toString();
    }
    const result = tokenize(text, tokenizer).map((word) => {
        return `'${word}`
    })
    if (searchType === "or") {
        return result.join(" | ")
    } else {
        return result.join(" ")
    }
}

function isSentenceField(key) {
    if (key.includes("tokenized")) {
        return false;
    }
    else {
        return true;
    }
}

function extractHighlightText(text, highlightText, key) {
    if (isSentenceField(key)) {
        const indices = highlightText.indices;
        return indices.map((index) => {
            return text.slice(index[0], index[1] + 1)
        })
    } else {
        return highlightText.value;
    }
}

function _addHighlight(orgText, hText) {
    return orgText.replace(hText, `<span class="highlight">${hText}</span>`);
}

function addHighlight(orgText, hText) {
    var text = orgText
    if (orgText.includes(hText)) {
        text = _addHighlight(text, hText)
    } else {
        text = _addHighlight(text, moji(hText).convert("KK", "HG").toString())
    }
    return text;
}

function highlight(orgText, highlightTexts, targetKey, searchType) {
    var text = orgText[targetKey]
    for (let i = 0; i < highlightTexts.length; i++) {
        const highlightText = highlightTexts[i]
        const key = highlightText.key

        var hitKey
        if (key.includes("_")) {
            hitKey = key.split("_")[1]
        } else {
            hitKey = key
        }
        if (hitKey !== targetKey) {
            break;
        }

        const hText = extractHighlightText(text, highlightText, key)
        if (isSentenceField(key)) {
            if (searchType === "or") {
                continue;
            }
            hText.forEach((ht) => {
                text = addHighlight(text, ht);
            })
            break; // escape duplicate highlighting
        } else {
            text = addHighlight(text, hText);
        }
    }
    // activate span tag
    return <div dangerouslySetInnerHTML={{ __html: text }}></div>
}


function FuseSearchEngine(props) {
    const fileInput = createRef();
    const [searchKeys, setSearchKeys] = useState([])
    const [documents, setDocuments] = useState([])
    const [options, setOptions] = useState()

    const tokenizer = props.tokenizer
    const searchType = props.searchType

    const handleTriggerReadFile = () => {
        if (fileInput.current) {
            fileInput.current.click()
        }
    }

    const handleReadFile = (fileObj) => {
        if (fileObj) {
            fileObj.arrayBuffer().then((buffer) => {
                const workbook = XLSX.read(buffer, { type: 'buffer', bookVBA: true })
                const firstSheetName = workbook.SheetNames[0]
                const worksheet = workbook.Sheets[firstSheetName]
                const data = XLSX.utils.sheet_to_json(worksheet)
                const orgKeys = Object.keys(data[0])
                var docs = [];
                data.forEach((doc) => {
                    var _doc = {};
                    Object.keys(doc).forEach((key) => {
                        _doc[key] = doc[key]
                        _doc[`search_${key}`] = encode(doc[key])
                        _doc[`tokenized_${key}`] = tokenize(doc[key], tokenizer)
                    })
                    docs.push(_doc)
                })

                var _searchKeys = orgKeys
                orgKeys.forEach((key) => {
                    _searchKeys.push(`search_${key}`)
                    _searchKeys.push(`tokenized_${key}`)
                })
                setSearchKeys(_searchKeys)
                setDocuments(docs)
            })
        }
    }

    // This will create a new search index. Here we are using all of the default options, but the docs show other choices that can be used. 

    const [index, setIndex] = useState(new Fuse(documents, options));

    //  Create state variables for query and results.

    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);

    //  When the component first loads, we need to iterate through data values and add each to the search index. 

    useEffect(() => {
        const options = {
            includeScore: true,
            includeMatches: true,
            useExtendedSearch: true,
            threshold: 0.3,
            keys: searchKeys,
        };
        setOptions(options)
    }, [searchKeys]);

    useEffect(() => {
        setIndex(new Fuse(documents, options))
    }, [documents]);

    //  When the query from the search input changes, we want to update the query state and thus the results to display. 

    useEffect(() => {
        setResults(index.search(cleanQuery(query, searchType, tokenizer)));
    }, [query]);

    console.log("index:", index)
    console.log("query:", cleanQuery(query, searchType, tokenizer));
    console.log("search org:", index.search(query));
    console.log("search: cleaned", index.search(cleanQuery(query, searchType, tokenizer)));

    return (
        <div>
            <h2>searchType: {searchType}, tokenizer: {tokenizer}</h2>
            <div style={{ padding: "20px" }}>
                <Button variant="contained" color="primary" onClick={() => handleTriggerReadFile()}>upload data</Button>
                <form style={{ display: "none" }}>
                    <input
                        type="file"
                        accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        ref={fileInput}
                        onChange={(e) => {
                            e.preventDefault()
                            handleReadFile(e.currentTarget.files[0])
                        }}
                    />
                </form>
            </div>
            <Paper
                component="form"
                sx={{ p: '2px 4px', display: 'flex', alignItems: 'center', width: 400 }}
            >
                <Divider sx={{ height: 28, m: 0.5 }} orientation="vertical" />
                <InputBase
                    sx={{ ml: 1, flex: 1 }}
                    placeholder="Input Search Text"
                    inputProps={{ 'aria-label': 'input search text' }}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <IconButton type="submit" sx={{ p: '10px' }} aria-label="search">
                    <SearchIcon />
                </IconButton>
                <Divider sx={{ height: 28, m: 0.5 }} orientation="vertical" />
            </Paper>
            <List>
                {results.map((result) => (
                    <ListItem>
                        <ListItemText key={result.item[searchKeys[0]]} primary={highlight(result.item, result.matches, searchKeys[0], searchType)} secondary={highlight(result.item, result.matches, searchKeys[1], searchType)} />
                    </ListItem>
                ))}
            </List>
        </div>
    );
};

export default FuseSearchEngine;
