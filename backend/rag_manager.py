import os
import shutil
# ✅ FIXED IMPORT: Uses the new 'langchain_text_splitters' module
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import SentenceTransformerEmbeddings
from langchain_community.document_loaders import TextLoader, PyPDFLoader, UnstructuredWordDocumentLoader

class RagManager:
    def __init__(self, persist_directory="chroma_db"):
        self.persist_directory = persist_directory
        self.embedding_function = SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")
        
        # Initialize Vector DB
        if os.path.exists(persist_directory):
            self.vector_db = Chroma(persist_directory=persist_directory, embedding_function=self.embedding_function)
        else:
            self.vector_db = None

    @property
    def has_context(self):
        """Returns True if the database exists and has data."""
        return self.vector_db is not None and self.vector_db._collection.count() > 0

    def ingest_document(self, file_path):
        """Reads a file, splits it, and saves it to the vector database."""
        try:
            # 1. Load the document based on extension
            if file_path.endswith(".pdf"):
                loader = PyPDFLoader(file_path)
            elif file_path.endswith(".docx"):
                loader = UnstructuredWordDocumentLoader(file_path)
            else:
                loader = TextLoader(file_path, encoding="utf-8")
            
            documents = loader.load()

            # 2. Split text into chunks
            text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
            chunks = text_splitter.split_documents(documents)

            # 3. Store in Vector DB (Chroma)
            if self.vector_db is None:
                self.vector_db = Chroma.from_documents(
                    documents=chunks, 
                    embedding=self.embedding_function, 
                    persist_directory=self.persist_directory
                )
            else:
                self.vector_db.add_documents(chunks)

            return True, "Document processed successfully."
        except Exception as e:
            print(f"RAG Error: {e}")
            return False, str(e)

    def retrieve_context(self, query, k=3):
        """Searches the database for relevant context."""
        if not self.has_context:
            return None
            
        results = self.vector_db.similarity_search(query, k=k)
        if not results:
            return None
            
        # Combine the content of the top results
        context_text = "\n\n".join([doc.page_content for doc in results])
        return context_text

    def clear_memory(self):
        """Deletes the vector database to reset memory."""
        if os.path.exists(self.persist_directory):
            shutil.rmtree(self.persist_directory)
            self.vector_db = None
            return "Memory cleared."
        return "Memory was already empty."