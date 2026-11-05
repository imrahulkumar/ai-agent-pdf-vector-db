import { Worker } from 'bullmq';
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const worker = new Worker('file-upload-queue', async job => {
  console.log('Processing job:', job.id, job.data);

  const vectorstore = await initializeVectorsStoreWithDocument({documents: splitDocs});


  /**
   * Path: data.path
   * read the pdf from path
   * chunk the pdf,
   * call the openai embedding model for every chunk,
   * store the chunk in qdrant db
   */

const splitDocs = await loadAndSplitChunks({
    chunkSize: 1536,
    chunkOverlap: 128,
    path: job.data.path,
});

initializeVectorsStoreWithDocument({documents: splitDocs});

},{
    concurrency: 100,
    connection: {
      host: 'localhost',
      port: '6379',
    },

});

async function loadAndSplitChunks({
  chunkSize,
  chunkOverlap,
  path
}) {
    const loader = new PDFLoader(path);
    const rawDocuments = await loader.load();
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
    });
    const splitDocs = await splitter.splitDocuments(rawDocuments);
    return splitDocs;
}

async function initializeVectorsStoreWithDocument({documents}) {
  const embeddings = new OpenAIEmbeddings({
     modelName: "embedding-gecko-001",
     taskType: "embedding",
     title: "Retrieval Document",
     apiKey: process.env.OPENAI_API_KEY
  });

  const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        url: 'http://localhost:6333',
        collectionName: 'langchainjs-testing',
      }
    );
    await vectorStore.addDocuments(docs);
    console.log(`All docs are added to vector store`);
}