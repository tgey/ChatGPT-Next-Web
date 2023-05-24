import React, { useState, useEffect, ChangeEvent } from "react";
import Youtube from "../icons/chat.svg";
import Delete from "../icons/chat.svg";
import styles from "./upload.module.scss";
// import request from 'request';

import { DocxLoader } from "langchain/document_loaders/fs/docx";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import axios from "axios";

export function UploadPage() {
  const [value, setValue] = useState("");
  const [result, setResult] = useState("");
  const [progress, setProgress] = useState<number>(0);
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState([null]);
  const [submitting, setSubmitting] = useState(false);
  const [isCopy, setIsCopy] = useState(false);

  const handleprompt = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setSubmitting(true);

    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Bearer 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",
      },
      body: JSON.stringify({
        prompt: value,
        temperature: 0.1,
        max_tokens: 1000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0.5,
        stop: ['"""'],
      }),
    };

    fetch(
      "https://api.openai.com/v1/engines/text-davinci-003/completions",
      requestOptions,
    )
      .then((response) => response.json())
      .then((dt) => {
        const text = dt.choices[0].text;
        setSubmitting(false);

        localStorage.setItem(
          "summary",
          JSON.stringify(data?.length > 0 ? [...data, text] : [text]),
        );

        fetchLocalStorage();
      })
      .catch((error) => {
        setSubmitting(false);
        console.log(error);
      });
  };

  async function upload(file: File): Promise<any | void> {
    let formData = new FormData();

    formData.append("file", file);
    formData.append("type", "txt");

    const protocol = window.location.protocol.includes("https") ? "wss" : "ws";
    const baseurl = `http://${location.hostname}:8000/upload_tmp_file`;
    try {
      const response = await axios.post<string>(baseurl, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      return response.data;
    } catch (error) {
      console.error(error);
      throw new Error("Failed to upload file.");
    }

    return new Promise<any | void>((resolve, reject) => {
      // const options: RequestInit = {
      //   method: 'POST',
      //   headers :{
      //     "Content-Type": "multipart/form-data",
      //   },
      //   body: formData,
      // };
      // fetch(baseurl, options)
      //   .then((response) => {
      //     if (!response.ok) {
      //       throw new Error('Upload failed');
      //     }
      //     resolve('OK');
      //   })
      //   .catch((error) => {
      //     reject(error);
      //   });
    });
  }

  const handlesubmit = async (e: { preventDefault: () => void }) => {
    let formData = new FormData();

    setProgress(0);
    if (!file) return;

    upload(file);
    // , (event: any) => {
    //   setProgress(Math.round((100 * event.loaded) / event.total));})
  };

  const handleanalyze = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setSubmitting(true);

    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Bearer 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",
      },
      body: JSON.stringify({
        model: "text-embedding-ada-002",
        input: value.replaceAll("\n", " "),
      }),
    };

    const embeddingResponse = await fetch(
      "https://api.openai.com/v1/embeddings",
      requestOptions,
    );

    const {
      data: [{ embedding }],
    } = await embeddingResponse.json();

    setSubmitting(false);

    localStorage.setItem("embeddings", JSON.stringify(data));

    fetchLocalStorage();
  };

  //   const { error: matchError, data: pageSections } = await supabaseClient.rpc(
  //     'match_page_sections',
  //     {
  //       embedding,
  //       match_threshold: 0.78,
  //       match_count: 10,
  //       min_content_length: 50,
  //     }
  //   )

  const fetchLocalEmbeddings = async () => {
    const result = await localStorage.getItem("embeddings");
    if (result) {
      setData(JSON.parse(result)?.reverse());
    }
  };

  const fetchLocalStorage = async () => {
    const result = await localStorage.getItem("summary");
    if (result) {
      setData(JSON.parse(result)?.reverse());
    }
  };

  async function copyTextToClipboard(text: string) {
    if ("clipboard" in navigator) {
      return await navigator.clipboard.writeText(text);
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
    setProgress(0);
    console.log(file);
  };

  const handleCopy = (txt: string | null) => {
    if (txt) {
      copyTextToClipboard(txt)
        .then(() => {
          setIsCopy(true);

          setTimeout(() => {
            setIsCopy(false);
          }, 1500);
        })
        .catch((err) => console.log(err));
    }
  };
  const handleDelete = (txt: null) => {
    const filtered = data?.filter((d) => d !== txt);

    setData(filtered);

    localStorage.setItem("summary", JSON.stringify(filtered));
  };
  useEffect(() => {
    fetchLocalStorage();
  }, []);

  return (
    <div
      className="w-full bg-[#0f172a] h-full min-h-[100vh]
        py-4
        px-4
        md:px-20"
    >
      <div className="w-full">
        <div
          className="flex flex-row justify-between items-center
          w-full h-10 px-5 2xl:px-40"
        >
          <h3 className="cursor-pointer text-3xl font-bold text-cyan-600">
            Summary!
          </h3>
        </div>

        <div
          className="flex flex-col items-center justify-center
          mt-4 p-4"
        >
          <h1 className="text-3xl text-white text-center leading-10 font-semibold">
            Summarizer with
            <br />
            <span className="text-5xl font-bold text-cyan-500">OpenAI GPT</span>
          </h1>
          <p className="mt-5 text-lg text-gray-500 sm:text-xl text-center max-w-2xl">
            Simply upload your document and get a quick summary using Neonomia
            Summerizer
          </p>
        </div>
        <form onSubmit={handlesubmit} className="form">
          <textarea
            placeholder="Enter text to summarize"
            // value={value}
            rows={6}
            onChange={(e) => setValue(e.target.value)}
            className={styles.textarea}
          />
          <label htmlFor="fileInput" className="label">
            Choose a PDF file:
            <input
              id="fileInput"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="file-input"
            />
          </label>

          {(value?.length > 0 || file) &&
            (submitting ? (
              <p className="text-md text-cyan-500 mt-5">
                Please wait ....encoding...
              </p>
            ) : (
              <button type="submit" className="upload-button">
                {file || value ? "Submit" : "No File or Text"}
              </button>
            ))}
        </form>
        {file && (
          <div className="progress my-3">
            <div
              className="progress-bar progress-bar-info"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ width: progress + "%" }}
            >
              {progress}%
            </div>
          </div>
        )}
        {/* {summary && <p className="summary">{summary}</p>} */}
      </div>

      <div
        className="w-full mt-10 flex flex-col gap-5 shadow-md
        items-center justify-center"
      >
        {data?.length > 0 && (
          <>
            <p className="text-white font-semibold text-lg">Summary History</p>
            {data?.map((d, index) => (
              <div
                key={index}
                className="max-w-2xl bg-slate-800 p-3 rounded-md"
              >
                <p className="text-gray-400 text-lg">{d}</p>
                <div className="flex gap-5 items-center justify-end mt-2">
                  <p
                    className="text-gray-500 font-semibold cursor-pointer"
                    onClick={() => handleCopy(d)}
                  >
                    {isCopy ? "Copied" : "Copy"}
                  </p>
                  <button
                    className="cursor-pointer"
                    onClick={() => handleDelete(d)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
